import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  closeCalls = 0;
  private listeners: Record<string, Array<(ev?: unknown) => void>> = {};

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, cb: (ev?: unknown) => void) {
    (this.listeners[type] ??= []).push(cb);
  }

  removeEventListener() {}

  close() {
    this.closeCalls++;
    this.readyState = FakeWebSocket.CLOSED;
  }

  emit(type: string, ev?: unknown) {
    for (const cb of this.listeners[type] ?? []) cb(ev);
  }
}

// The module under test keeps connection/backoff state in module-level
// variables (a deliberate singleton, since there's only ever one counter
// socket per page), so each test needs a fresh module instance to avoid
// bleeding state (e.g. the `started` guard) across cases.
async function freshModule() {
  vi.resetModules();
  const state = await import("./state.svelte.ts");
  const socket = await import("./counterSocket.ts");
  return { ...socket, ...state };
}

describe("counterSocket", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens exactly one socket even if called more than once", async () => {
    const { connectCounterSocket } = await freshModule();
    connectCounterSocket();
    connectCounterSocket();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("builds a ws:// url for http pages", async () => {
    const { connectCounterSocket } = await freshModule();
    connectCounterSocket();
    expect(FakeWebSocket.instances[0].url).toMatch(/^ws:\/\/.*\/ws-counter$/);
  });

  it("builds a wss:// url for https pages", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, protocol: "https:", host: "example.com" },
      configurable: true,
    });

    const { connectCounterSocket } = await freshModule();
    connectCounterSocket();
    expect(FakeWebSocket.instances[0].url).toBe("wss://example.com/ws-counter");

    Object.defineProperty(window, "location", { value: originalLocation, configurable: true });
  });

  it("clears the error flag on open", async () => {
    const { connectCounterSocket, counterState } = await freshModule();
    counterState.error = true;
    counterState.errorMessage = "stale";

    connectCounterSocket();
    FakeWebSocket.instances[0].emit("open");

    expect(counterState.error).toBe(false);
    expect(counterState.errorMessage).toBeNull();
  });

  it("applies a valid message to counterState", async () => {
    const { connectCounterSocket, counterState } = await freshModule();
    connectCounterSocket();

    const payload = [{ path: "/", total_unique_visitors: 5 }];
    FakeWebSocket.instances[0].emit("message", { data: JSON.stringify(payload) });

    expect(counterState.pageCounts).toEqual(payload);
    expect(counterState.loading).toBe(false);
    expect(counterState.completedOnce).toBe(true);
    expect(counterState.error).toBe(false);
    expect(counterState.errorMessage).toBeNull();
  });

  it("flags an error on an unparseable message", async () => {
    const { connectCounterSocket, counterState } = await freshModule();
    connectCounterSocket();

    FakeWebSocket.instances[0].emit("message", { data: "not json" });

    expect(counterState.error).toBe(true);
    expect(counterState.errorMessage).toMatch(/unreadable/i);
  });

  it("marks an error and schedules a reconnect on close", async () => {
    const { connectCounterSocket, counterState } = await freshModule();
    connectCounterSocket();

    FakeWebSocket.instances[0].emit("close");
    expect(counterState.error).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("doubles the backoff delay on repeated drops, capped at 30s", async () => {
    const { connectCounterSocket } = await freshModule();
    connectCounterSocket();

    FakeWebSocket.instances[0].emit("close");
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    FakeWebSocket.instances[1].emit("close");
    vi.advanceTimersByTime(1999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it("does not stack a second reconnect timer if close fires again before it runs", async () => {
    const { connectCounterSocket } = await freshModule();
    connectCounterSocket();

    const ws = FakeWebSocket.instances[0];
    ws.emit("close");
    ws.emit("close");

    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("closes the socket on error, deferring reconnect scheduling to the close handler", async () => {
    const { connectCounterSocket } = await freshModule();
    connectCounterSocket();

    const ws = FakeWebSocket.instances[0];
    ws.emit("error");

    expect(ws.closeCalls).toBe(1);
  });

  it("reconnects immediately when the tab becomes visible again after a drop", async () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const { connectCounterSocket } = await freshModule();
    connectCounterSocket();
    FakeWebSocket.instances[0].emit("close");

    const visibilityHandler = addSpy.mock.calls.find(
      ([type]) => type === "visibilitychange",
    )?.[1] as () => void;
    expect(visibilityHandler).toBeTypeOf("function");

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    visibilityHandler();

    expect(FakeWebSocket.instances).toHaveLength(2);

    // The original reconnect timer (scheduled by the close above) is still
    // pending; when it now fires, connect() should see the socket the
    // visibility handler just opened and no-op instead of opening a third.
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("ignores visibilitychange while still connecting (not yet open)", async () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const { connectCounterSocket } = await freshModule();
    connectCounterSocket();
    // readyState defaults to CONNECTING - no close/open emitted.

    const visibilityHandler = addSpy.mock.calls.find(
      ([type]) => type === "visibilitychange",
    )?.[1] as () => void;

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    visibilityHandler();

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("ignores visibilitychange while already connecting or open", async () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const { connectCounterSocket } = await freshModule();
    connectCounterSocket();
    FakeWebSocket.instances[0].readyState = FakeWebSocket.OPEN;

    const visibilityHandler = addSpy.mock.calls.find(
      ([type]) => type === "visibilitychange",
    )?.[1] as () => void;

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    visibilityHandler();

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("ignores visibilitychange while the tab is hidden", async () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const { connectCounterSocket } = await freshModule();
    connectCounterSocket();
    FakeWebSocket.instances[0].emit("close");

    const visibilityHandler = addSpy.mock.calls.find(
      ([type]) => type === "visibilitychange",
    )?.[1] as () => void;

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    visibilityHandler();

    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
