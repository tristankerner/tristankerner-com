use actix_files::NamedFile;
use actix_web::http::header::{self, ContentEncoding, HeaderValue};
use actix_web::http::Method;
use actix_web::{middleware, rt, web, App, Error, HttpRequest, HttpResponse, HttpServer, Result};
use actix_ws::AggregatedMessage;
use futures_util::StreamExt as _;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::watch;

const BUILD_DIR: &str = "./frontend/build";

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

// Total simultaneous TCP connections accepted per worker. The actix default
// (25k) is sized for big machines; keep it under a typical 1024 fd ulimit so
// overload degrades into refused connections instead of accept errors.
const MAX_CONNECTIONS: usize = 768;

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

// Maps a request path to a relative path inside `BUILD_DIR`. Returns None for the
// root path and for any path with empty, dot-prefixed (`.`, `..`, hidden files),
// or backslash-containing segments. `req.path()` is *not* percent-decoded, so
// encoded traversal sequences (`%2e%2e`) never reach the filesystem — they simply
// fail to match a real file and fall through to the SPA shell.
fn sanitized_rel_path(request_path: &str) -> Option<PathBuf> {
    let trimmed = request_path.trim_matches('/');
    if trimmed.is_empty() {
        return None;
    }

    let mut rel = PathBuf::new();
    for segment in trimmed.split('/') {
        if segment.is_empty() || segment.starts_with('.') || segment.contains('\\') {
            return None;
        }
        rel.push(segment);
    }
    Some(rel)
}

// SvelteKit (adapter-static, prerender = true) emits one static HTML file per
// route (e.g. `/about-me` -> `about-me.html`). Resolution order: exact asset
// file, prerendered page, SPA shell for genuinely unknown routes.
fn resolve_target(request_path: &str) -> PathBuf {
    let build_dir = Path::new(BUILD_DIR);

    if let Some(rel) = sanitized_rel_path(request_path) {
        let direct = build_dir.join(&rel);
        if direct.is_file() {
            return direct;
        }

        let mut html = direct;
        html.set_extension("html");
        if html.is_file() {
            return html;
        }
    }

    build_dir.join("index.html")
}

// Minimal Accept-Encoding check: the encoding is listed and not refused with q=0.
fn encoding_allowed(accept_encoding: &str, name: &str) -> bool {
    accept_encoding.split(',').any(|part| {
        let mut pieces = part.split(';');
        let token = pieces.next().unwrap_or("").trim();
        if !token.eq_ignore_ascii_case(name) {
            return false;
        }
        !pieces.any(|param| {
            param
                .trim()
                .strip_prefix("q=")
                .and_then(|q| q.trim().parse::<f32>().ok())
                .is_some_and(|q| q == 0.0)
        })
    })
}

// `vite build` (adapter-static with `precompress: true`) emits `.br`/`.gz`
// siblings for every asset; serve those instead of compressing on the fly so
// page loads cost zero compression CPU.
fn precompressed_variant(
    target: &Path,
    accept_encoding: &str,
) -> Option<(PathBuf, ContentEncoding)> {
    const VARIANTS: [(&str, &str, ContentEncoding); 2] = [
        ("br", ".br", ContentEncoding::Brotli),
        ("gzip", ".gz", ContentEncoding::Gzip),
    ];

    for (name, suffix, encoding) in VARIANTS {
        if !encoding_allowed(accept_encoding, name) {
            continue;
        }
        let mut os = target.as_os_str().to_os_string();
        os.push(suffix);
        let candidate = PathBuf::from(os);
        if candidate.is_file() {
            return Some((candidate, encoding));
        }
    }
    None
}

async fn serve_frontend(req: HttpRequest) -> Result<HttpResponse> {
    if !matches!(*req.method(), Method::GET | Method::HEAD) {
        return Ok(HttpResponse::MethodNotAllowed()
            .insert_header((header::ALLOW, "GET, HEAD"))
            .finish());
    }

    let target = resolve_target(req.path());
    let is_html = target.extension().is_some_and(|ext| ext == "html");

    let accept_encoding = req
        .headers()
        .get(header::ACCEPT_ENCODING)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");

    let (file_path, encoding) = match precompressed_variant(&target, accept_encoding) {
        Some((path, encoding)) => (path, Some(encoding)),
        None => (target.clone(), None),
    };

    // Content type must come from the original path — the variant's `.br`/`.gz`
    // extension would otherwise guess as octet-stream. Content-Disposition is
    // dropped entirely: NamedFile derives it from the *opened* file's guessed
    // type at open time, so a `.br` variant would be tagged `attachment` and
    // browsers would download the page instead of rendering it.
    let mut file = NamedFile::open(file_path)?
        .set_content_type(mime_guess::from_path(&target).first_or_octet_stream())
        .disable_content_disposition();
    if let Some(encoding) = encoding {
        file = file.set_content_encoding(encoding);
    }

    // Hashed build chunks never change; HTML must revalidate (cheap via the ETag
    // NamedFile already emits) so deploys are picked up immediately.
    let cache_control = if req.path().starts_with("/_app/immutable/") {
        "public, max-age=31536000, immutable"
    } else if is_html {
        "no-cache"
    } else {
        "public, max-age=3600"
    };

    let mut res = file.into_response(&req);
    res.headers_mut()
        .insert(header::VARY, HeaderValue::from_static("accept-encoding"));
    res.headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static(cache_control));
    Ok(res)
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

async fn ws_counter(
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
            // Only add headers the statically generated pages can't set themselves;
            // HSTS belongs on whatever terminates TLS in front of this server.
            .wrap(
                middleware::DefaultHeaders::new()
                    .add((header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
                    .add((header::X_FRAME_OPTIONS, "DENY"))
                    .add((header::REFERRER_POLICY, "strict-origin-when-cross-origin")),
            )
            .route("/ws-counter", web::get().to(ws_counter))
            // Everything else is the static SvelteKit build (assets, prerendered
            // pages, SPA-shell fallback), with precompressed variants and caching.
            .default_service(web::to(serve_frontend))
    })
    .max_connections(MAX_CONNECTIONS)
    .bind((bind_host(), bind_port()))?
    .run()
    .await
}

// Defaults match the bare-metal VPS deployment (loopback behind a fronting TLS
// proxy); HOST/PORT let the Docker image bind 0.0.0.0 on a different port
// without changing that default.
fn bind_host() -> String {
    std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string())
}

fn bind_port() -> u16 {
    std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080)
}
