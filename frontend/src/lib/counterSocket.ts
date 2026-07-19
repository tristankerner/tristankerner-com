import { counterState, type PageVisitorCount } from "./state.svelte.ts";

const WS_PATH = "/ws-counter";
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

let socket: WebSocket | null = null;
let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${WS_PATH}`;
}

function isConnectingOrOpen(): boolean {
  return (
    socket !== null &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  );
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer !== null) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
}

function connect() {
  if (isConnectingOrOpen()) return;

  clearReconnectTimer();
  const ws = new WebSocket(socketUrl());
  socket = ws;

  ws.addEventListener("open", () => {
    reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    counterState.error = false;
    counterState.errorMessage = null;
  });

  ws.addEventListener("message", (event) => {
    try {
      counterState.pageCounts = JSON.parse(event.data) as PageVisitorCount[];
      counterState.loading = false;
      counterState.completedOnce = true;
      counterState.error = false;
      counterState.errorMessage = null;
    } catch {
      counterState.error = true;
      counterState.errorMessage = "Received an unreadable visitor counter update.";
    }
  });

  ws.addEventListener("close", () => {
    if (socket === ws) {
      socket = null;
    }
    counterState.error = true;
    scheduleReconnect();
  });

  ws.addEventListener("error", () => {
    // The browser fires 'close' right after 'error' on connection failures;
    // let the close handler own reconnect scheduling.
    ws.close();
  });
}

/**
 * Opens the persistent visitor-counter socket and keeps it connected for the
 * lifetime of the app, reconnecting with backoff whenever it drops. Safe to
 * call more than once — only the first call has any effect.
 */
export function connectCounterSocket() {
  if (started) return;
  started = true;

  connect();

  // Background tabs get their timers throttled, so a dropped connection can sit
  // out most of the backoff window unnoticed. Retry immediately on refocus.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || isConnectingOrOpen()) return;
    reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    connect();
  });
}
