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

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test::TestRequest;
    use serial_test::serial;

    #[test]
    fn counters_json_serializes_the_expected_shape() {
        let counters = vec![
            PathVisitorCount {
                path: "/".to_string(),
                total_unique_visitors: 3,
            },
            PathVisitorCount {
                path: "/about-me".to_string(),
                total_unique_visitors: 0,
            },
        ];

        assert_eq!(
            counters_json(&counters),
            r#"[{"path":"/","total_unique_visitors":3},{"path":"/about-me","total_unique_visitors":0}]"#
        );
    }

    #[test]
    fn same_origin_allows_requests_with_no_origin_header() {
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .to_http_request();
        assert!(same_origin(&req));
    }

    #[test]
    fn same_origin_allows_a_matching_https_origin() {
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .insert_header((header::ORIGIN, "https://example.com"))
            .to_http_request();
        assert!(same_origin(&req));
    }

    #[test]
    fn same_origin_allows_a_matching_http_origin_case_insensitively() {
        let req = TestRequest::default()
            .insert_header((header::HOST, "Example.com"))
            .insert_header((header::ORIGIN, "http://example.com"))
            .to_http_request();
        assert!(same_origin(&req));
    }

    #[test]
    fn same_origin_rejects_a_mismatched_origin() {
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .insert_header((header::ORIGIN, "https://evil.example"))
            .to_http_request();
        assert!(!same_origin(&req));
    }

    #[test]
    fn same_origin_rejects_an_origin_without_a_recognized_scheme() {
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .insert_header((header::ORIGIN, "ftp://example.com"))
            .to_http_request();
        assert!(!same_origin(&req));
    }

    #[test]
    fn same_origin_rejects_when_host_is_missing() {
        let req = TestRequest::default()
            .insert_header((header::ORIGIN, "https://example.com"))
            .to_http_request();
        assert!(!same_origin(&req));
    }

    #[test]
    fn same_origin_rejects_a_non_utf8_origin_header() {
        let bad_value = actix_web::http::header::HeaderValue::from_bytes(&[0xff, 0xfe]).unwrap();
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .insert_header((header::ORIGIN, bad_value))
            .to_http_request();
        assert!(!same_origin(&req));
    }

    #[test]
    #[serial(ws_sessions)]
    fn session_slot_enforces_the_concurrency_cap_and_releases_on_drop() {
        // Baseline first: WS_SESSIONS is process-wide, so start from whatever
        // it currently is rather than assuming a pristine 0.
        let baseline = WS_SESSIONS.load(Ordering::Relaxed);
        let room_left = MAX_WS_SESSIONS - baseline;

        let slots: Vec<SessionSlot> = (0..room_left)
            .map(|_| SessionSlot::try_acquire().expect("should have room"))
            .collect();
        assert_eq!(WS_SESSIONS.load(Ordering::Relaxed), MAX_WS_SESSIONS);

        assert!(SessionSlot::try_acquire().is_none());

        drop(slots);
        assert_eq!(WS_SESSIONS.load(Ordering::Relaxed), baseline);

        // The budget is usable again once slots are freed.
        let reacquired = SessionSlot::try_acquire().expect("should have room again");
        drop(reacquired);
    }

    #[actix_web::test]
    async fn start_seeds_the_watch_channel_with_zeroed_counts_for_every_seed_path() {
        let tx = start();
        let rx = tx.subscribe();
        let initial = rx.borrow().clone();

        assert_eq!(
            initial,
            r#"[{"path":"/","total_unique_visitors":0},{"path":"/about-me","total_unique_visitors":0}]"#
        );
    }

    // Real websocket-protocol integration tests for `handle`, using a bound
    // test server plus a real client (rather than `start()`, so each test
    // controls its own watch channel directly instead of waiting on the real
    // 60s visitor ticker).
    mod handle_ws {
        use super::*;
        use actix_web::web::Bytes;
        use actix_web::{App, web};
        use awc::ws::{Frame, Message};
        use futures_util::{SinkExt, StreamExt};

        fn test_app_with_channel() -> (actix_test::TestServer, watch::Sender<String>) {
            let (tx, _rx) = watch::channel(counters_json(&[]));
            let data = web::Data::new(tx.clone());
            let srv = actix_test::start(move || {
                App::new()
                    .app_data(data.clone())
                    .route("/ws-counter", web::get().to(handle))
            });
            (srv, tx)
        }

        #[actix_web::test]
        async fn sends_the_current_snapshot_immediately_on_connect() {
            let counters = vec![PathVisitorCount {
                path: "/".to_string(),
                total_unique_visitors: 5,
            }];
            let (tx, _rx) = watch::channel(counters_json(&counters));
            let data = web::Data::new(tx);
            let mut srv = actix_test::start(move || {
                App::new()
                    .app_data(data.clone())
                    .route("/ws-counter", web::get().to(handle))
            });

            let mut framed = srv.ws_at("/ws-counter").await.unwrap();
            let frame = framed.next().await.unwrap().unwrap();

            match frame {
                Frame::Text(bytes) => {
                    assert_eq!(
                        bytes,
                        Bytes::from_static(br#"[{"path":"/","total_unique_visitors":5}]"#)
                    );
                }
                other => panic!("expected an initial text snapshot, got {other:?}"),
            }
        }

        #[actix_web::test]
        async fn pushes_updates_published_on_the_watch_channel() {
            let (mut srv, tx) = test_app_with_channel();
            let mut framed = srv.ws_at("/ws-counter").await.unwrap();
            let _initial = framed.next().await.unwrap().unwrap();

            let updated = counters_json(&[PathVisitorCount {
                path: "/".to_string(),
                total_unique_visitors: 9,
            }]);
            tx.send(updated.clone()).unwrap();

            let frame = framed.next().await.unwrap().unwrap();
            match frame {
                Frame::Text(bytes) => assert_eq!(bytes, Bytes::from(updated)),
                other => panic!("expected the updated snapshot, got {other:?}"),
            }
        }

        #[actix_web::test]
        async fn responds_to_a_client_ping_with_a_pong() {
            let (mut srv, _tx) = test_app_with_channel();
            let mut framed = srv.ws_at("/ws-counter").await.unwrap();
            let _initial = framed.next().await.unwrap().unwrap();

            framed
                .send(Message::Ping(Bytes::from_static(b"hi")))
                .await
                .unwrap();

            let frame = framed.next().await.unwrap().unwrap();
            assert!(matches!(frame, Frame::Pong(bytes) if bytes == Bytes::from_static(b"hi")));
        }

        #[actix_web::test]
        async fn closes_the_session_when_the_client_sends_close() {
            let (mut srv, _tx) = test_app_with_channel();
            let mut framed = srv.ws_at("/ws-counter").await.unwrap();
            let _initial = framed.next().await.unwrap().unwrap();

            framed.send(Message::Close(None)).await.unwrap();

            match framed.next().await {
                Some(Ok(Frame::Close(_))) => {}
                None => {}
                other => panic!("expected a close frame or end of stream, got {other:?}"),
            }
        }

        #[actix_web::test]
        async fn rejects_a_cross_origin_websocket_upgrade() {
            let (srv, _tx) = test_app_with_channel();

            let client = awc::Client::new();
            let result = client
                .ws(srv.url("/ws-counter"))
                .header("Origin", "https://evil.example")
                .connect()
                .await;

            assert!(result.is_err());
        }
    }
}
