use actix_web::http::header;
use actix_web::{Error, HttpRequest, HttpResponse, Result, rt, web};
use actix_ws::AggregatedMessage;
use futures_util::StreamExt as _;
use serde::Serialize;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::watch;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);
const VISITOR_TICK_INTERVAL: Duration = Duration::from_secs(60);

// The counter payload is a few hundred bytes and clients never legitimately send
// text/binary data, so anything above this is either a bug or abuse.
const MAX_WS_MESSAGE_SIZE: usize = 1024;

// Upper bound on concurrent counter sessions so a burst of sockets can't exhaust
// memory/file descriptors on a small host. Each session is one spawned task plus
// a watch receiver, so the cap is about resource ceiling, not throughput.
const MAX_WS_SESSIONS: usize = 256;

// TODO(GA integration): this hardcoded list stands in for the set of pages Google
// Analytics knows about. Once the scheduled job below calls the GA Data API, the
// paths themselves (not just their counts) should come from that response instead
// of being seeded here.
const SEED_PATHS: &[&str] = &["/", "/about-me"];

#[derive(Serialize)]
struct PathVisitorCount {
    path: String,
    total_unique_visitors: u64,
}

fn counters_json(counters: &[PathVisitorCount]) -> String {
    serde_json::to_string(counters).unwrap()
}

static WS_SESSIONS: AtomicUsize = AtomicUsize::new(0);

// RAII slot in the websocket session budget; dropping it (task end, handshake
// failure) releases the slot.
struct SessionSlot;

impl SessionSlot {
    fn try_acquire() -> Option<SessionSlot> {
        let mut current = WS_SESSIONS.load(Ordering::Relaxed);
        loop {
            if current >= MAX_WS_SESSIONS {
                return None;
            }
            match WS_SESSIONS.compare_exchange_weak(
                current,
                current + 1,
                Ordering::AcqRel,
                Ordering::Relaxed,
            ) {
                Ok(_) => return Some(SessionSlot),
                Err(actual) => current = actual,
            }
        }
    }
}

impl Drop for SessionSlot {
    fn drop(&mut self) {
        WS_SESSIONS.fetch_sub(1, Ordering::AcqRel);
    }
}

// Browsers always send Origin on WebSocket upgrades, so this blocks other sites
// from opening sockets against us (cross-site WebSocket hijacking / resource
// abuse). Requests without an Origin (curl, monitoring) are allowed — the data
// is public and non-browser clients aren't confused deputies. NOTE: any reverse
// proxy in front must forward the original Host header (nginx:
// `proxy_set_header Host $host;`) or browser upgrades will be rejected here.
fn same_origin(req: &HttpRequest) -> bool {
    let Some(origin) = req.headers().get(header::ORIGIN) else {
        return true;
    };
    let Ok(origin) = origin.to_str() else {
        return false;
    };
    let Some(host) = req
        .headers()
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
    else {
        return false;
    };

    origin
        .strip_prefix("https://")
        .or_else(|| origin.strip_prefix("http://"))
        .is_some_and(|origin_host| origin_host.eq_ignore_ascii_case(host))
}

pub(crate) async fn handle(
    req: HttpRequest,
    body: web::Payload,
    tx: web::Data<watch::Sender<String>>,
) -> Result<HttpResponse, Error> {
    if !same_origin(&req) {
        return Ok(HttpResponse::Forbidden().finish());
    }

    let Some(slot) = SessionSlot::try_acquire() else {
        return Ok(HttpResponse::ServiceUnavailable().finish());
    };

    let (response, mut session, msg_stream) = actix_ws::handle(&req, body)?;

    let mut msg_stream = msg_stream
        .aggregate_continuations()
        .max_continuation_size(MAX_WS_MESSAGE_SIZE);

    // No mutex here: `watch` hands out the latest published snapshot directly.
    let mut rx = tx.subscribe();
    let initial_snapshot = rx.borrow().clone();

    rt::spawn(async move {
        let _slot = slot;

        let mut last_heartbeat = Instant::now();
        let mut heartbeat_interval = rt::time::interval(HEARTBEAT_INTERVAL);

        if session.text(initial_snapshot).await.is_err() {
            return;
        }

        loop {
            tokio::select! {
                _ = heartbeat_interval.tick() => {
                    if Instant::now().duration_since(last_heartbeat) > CLIENT_TIMEOUT {
                        break;
                    }
                    if session.ping(b"").await.is_err() {
                        break;
                    }
                }

                changed = rx.changed() => {
                    if changed.is_err() {
                        // Ticker task is gone; no further updates will ever arrive.
                        break;
                    }
                    let snapshot = rx.borrow_and_update().clone();
                    if session.text(snapshot).await.is_err() {
                        break;
                    }
                }

                msg = msg_stream.next() => {
                    match msg {
                        Some(Ok(AggregatedMessage::Ping(bytes))) => {
                            last_heartbeat = Instant::now();
                            if session.pong(&bytes).await.is_err() {
                                break;
                            }
                        }
                        Some(Ok(AggregatedMessage::Pong(_))) => {
                            last_heartbeat = Instant::now();
                        }
                        Some(Ok(AggregatedMessage::Text(_) | AggregatedMessage::Binary(_))) => {
                            last_heartbeat = Instant::now();
                        }
                        Some(Ok(AggregatedMessage::Close(reason))) => {
                            let _ = session.close(reason).await;
                            return;
                        }
                        Some(Err(_)) | None => break,
                    }
                }
            }
        }

        // Connection died or the heartbeat timed out: close the session and let `rx`
        // drop off the end of this task so the watch channel frees its subscriber slot.
        let _ = session.close(None).await;
    });

    Ok(response)
}

fn spawn_visitor_ticker(tx: watch::Sender<String>, mut counters: Vec<PathVisitorCount>) {
    rt::spawn(async move {
        let mut interval = rt::time::interval(VISITOR_TICK_INTERVAL);
        loop {
            interval.tick().await;

            // TODO(GA integration): replace this block with a call to the Google
            // Analytics Data API (`runReport`, grouped by `pagePath`, metric
            // `totalUsers` or `activeUsers`), then set each `total_unique_visitors`
            // to the value GA returns for that path instead of incrementing locally.
            // `counters` is only ever touched from this task, so no locking is needed
            // here even after that change.
            for counter in counters.iter_mut() {
                counter.total_unique_visitors += 1;
            }

            let _ = tx.send(counters_json(&counters));
        }
    });
}

pub(crate) fn start() -> watch::Sender<String> {
    let initial_counters: Vec<PathVisitorCount> = SEED_PATHS
        .iter()
        .map(|path| PathVisitorCount {
            path: (*path).to_string(),
            total_unique_visitors: 0,
        })
        .collect();

    let (tx, _rx) = watch::channel(counters_json(&initial_counters));
    spawn_visitor_ticker(tx.clone(), initial_counters);
    tx
}
