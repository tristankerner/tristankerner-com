use actix_files::{Files, NamedFile};
use actix_web::{rt, web, App, Error, HttpRequest, HttpResponse, HttpServer, Result};
use actix_ws::AggregatedMessage;
use futures_util::StreamExt as _;
use serde::Serialize;
use std::time::{Duration, Instant};
use tokio::sync::watch;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);
const VISITOR_TICK_INTERVAL: Duration = Duration::from_secs(60);

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

async fn index() -> Result<NamedFile> {
    // Serves the entry point of your Svelte SPA
    Ok(NamedFile::open("./frontend/build/index.html")?)
}

async fn ws_counter(
    req: HttpRequest,
    body: web::Payload,
    tx: web::Data<watch::Sender<String>>,
) -> Result<HttpResponse, Error> {
    let (response, mut session, msg_stream) = actix_ws::handle(&req, body)?;

    let mut msg_stream = msg_stream
        .aggregate_continuations()
        .max_continuation_size(2_usize.pow(20));

    // No mutex here: `watch` hands out the latest published snapshot directly.
    let mut rx = tx.subscribe();
    let initial_snapshot = rx.borrow().clone();

    rt::spawn(async move {
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let initial_counters: Vec<PathVisitorCount> = SEED_PATHS
        .iter()
        .map(|path| PathVisitorCount {
            path: (*path).to_string(),
            total_unique_visitors: 0,
        })
        .collect();

    let (tx, _rx) = watch::channel(counters_json(&initial_counters));

    spawn_visitor_ticker(tx.clone(), initial_counters);

    let tx = web::Data::new(tx);

    HttpServer::new(move || {
        App::new()
            .app_data(tx.clone())
            // 1. Place your API routes BEFORE frontend asset services
            .service(web::scope("/api"))
            .route("/ws-counter", web::get().to(ws_counter))
            // 2. Serve static assets (JS, CSS, Images) from the build folder
            .service(Files::new("/", "./frontend/build")
                         .index_file("index.html")
                         .default_handler(web::route().to(index))
                     // TODO: try_compressed() should be available for next release?
                     // Handles Svelte client routing fixes
            )
    })
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}
