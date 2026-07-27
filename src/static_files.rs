use crate::store::{ShortTermVisit, VisitorTracker};
use crate::visitor_key;
use actix_files::NamedFile;
use actix_web::http::Method;
use actix_web::http::StatusCode;
use actix_web::http::header::{self, ContentEncoding, HeaderValue};
use actix_web::{HttpRequest, HttpResponse, Result, web};
use std::path::{Path, PathBuf};

#[cfg(not(test))]
const BUILD_DIR: &str = "./frontend/build";
// Tests use a tiny checked-in fixture tree instead of the real frontend
// build output, so `cargo test` doesn't depend on the frontend having been
// built first. See tests/fixtures/static-build/.
#[cfg(test)]
const BUILD_DIR: &str = "./tests/fixtures/static-build";

// Maps a request path to a relative path inside `BUILD_DIR`. Returns None for the
// root path and for any path with empty, dot-prefixed (`.`, `..`, hidden files),
// or backslash-containing segments. `req.path()` is *not* percent-decoded, so
// encoded traversal sequences (`%2e%2e`) never reach the filesystem — they simply
// fail to match a real file and fall through to the 404 page.
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

// Old links to a since-removed standalone resume page now point visitors at
// the resume section of the about-me page instead of a 404.
fn redirect_target(request_path: &str) -> Option<&'static str> {
    match request_path.trim_end_matches('/') {
        "/resume" | "/live-resume" => Some("/about-me"),
        _ => None,
    }
}

// SvelteKit (adapter-static, prerender = true) emits one static HTML file per
// route (e.g. `/about-me` -> `about-me.html`) plus a generic `404.html`
// fallback (the adapter's `fallback` option, see frontend/vite.config.ts) for
// every other path. Resolution order: exact asset file, prerendered page,
// 404 page for genuinely unknown routes.
//
// Every real route is prerendered, so unlike a true SPA fallback this never
// serves the home page for an unknown path - a typo'd URL, a stale link, or
// a bot probing for `/wp-login.php` gets an actual 404 status, and
// record_page_view (below) skips counting it as a visit.
//
// Takes `build_dir` explicitly (rather than reading BUILD_DIR itself) so
// tests can point it at a throwaway directory instead of the real build
// output.
fn resolve_target(request_path: &str, build_dir: &Path) -> (PathBuf, StatusCode) {
    // sanitized_rel_path also rejects the root path, but "/" is the one
    // path that's never expected to be a 404 - it's the index route.
    if request_path.trim_matches('/').is_empty() {
        return (build_dir.join("index.html"), StatusCode::OK);
    }

    if let Some(rel) = sanitized_rel_path(request_path) {
        let direct = build_dir.join(&rel);
        if direct.is_file() {
            return (direct, StatusCode::OK);
        }

        let mut html = direct;
        html.set_extension("html");
        if html.is_file() {
            return (html, StatusCode::OK);
        }
    }

    (build_dir.join("404.html"), StatusCode::NOT_FOUND)
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

pub(crate) async fn serve(
    req: HttpRequest,
    tracker: web::Data<VisitorTracker>,
) -> Result<HttpResponse> {
    if !matches!(*req.method(), Method::GET | Method::HEAD) {
        return Ok(HttpResponse::MethodNotAllowed()
            .insert_header((header::ALLOW, "GET, HEAD"))
            .finish());
    }

    if let Some(location) = redirect_target(req.path()) {
        return Ok(HttpResponse::MovedPermanently()
            .insert_header((header::LOCATION, location))
            .finish());
    }

    let (target, status) = resolve_target(req.path(), Path::new(BUILD_DIR));
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
    // NamedFile may have already answered with 304 (conditional GET) or 206
    // (Range) instead of 200 - only force the "unknown route" status onto an
    // otherwise-plain 200, so a repeat request for the same 404 page can
    // still revalidate normally.
    if status == StatusCode::NOT_FOUND && res.status() == StatusCode::OK {
        *res.status_mut() = StatusCode::NOT_FOUND;
    }
    res.headers_mut()
        .insert(header::VARY, HeaderValue::from_static("accept-encoding"));
    res.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(cache_control),
    );

    record_page_view(&req, is_html, status, &tracker);
    Ok(res)
}

// Only counts genuine page loads (a 200 HTML response to a real GET), not
// HEAD requests, the JS/CSS/image/font sub-resource requests a page load
// also triggers, or 404s for paths that were never real pages (typos, stale
// links, bots probing for e.g. `/wp-login.php`) - see resolve_target.
// Cheap and non-blocking: HMAC computation is pure CPU work (microseconds)
// and `try_send` never waits on I/O - the actual database write happens
// later, off this request path entirely (see store::spawn_writer). Silently
// does nothing without a peer address (e.g. some test setups), since
// there's no visitor to key on.
fn record_page_view(
    req: &HttpRequest,
    is_html: bool,
    status: StatusCode,
    tracker: &VisitorTracker,
) {
    if !is_html || status != StatusCode::OK || *req.method() != Method::GET {
        return;
    }
    let Some(ip) = visitor_key::client_ip(req) else {
        return;
    };

    let user_agent = visitor_key::user_agent(req);
    let day = chrono::Utc::now().date_naive();
    let visitor_key = visitor_key::derive(&tracker.hash_secret, &ip, user_agent, day);

    // A full queue or a closed writer just means this one visit is
    // dropped - never a slower or failed page response.
    let _ = tracker.sender.try_send(ShortTermVisit {
        day,
        path: req.path().to_string(),
        visitor_key,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test::TestRequest;
    use std::fs;
    use std::net::SocketAddr;

    fn test_tracker() -> web::Data<VisitorTracker> {
        let (sender, _rx) = tokio::sync::mpsc::channel(8);
        web::Data::new(VisitorTracker {
            sender,
            hash_secret: std::sync::Arc::new(vec![0u8; 32]),
        })
    }

    fn with_peer_addr(builder: TestRequest) -> TestRequest {
        let addr: SocketAddr = "203.0.113.1:12345".parse().unwrap();
        builder.peer_addr(addr)
    }

    #[test]
    fn sanitized_rel_path_rejects_the_root() {
        assert_eq!(sanitized_rel_path("/"), None);
        assert_eq!(sanitized_rel_path(""), None);
    }

    #[test]
    fn sanitized_rel_path_accepts_a_simple_path() {
        assert_eq!(
            sanitized_rel_path("/about-me"),
            Some(PathBuf::from("about-me"))
        );
    }

    #[test]
    fn sanitized_rel_path_accepts_a_nested_path() {
        assert_eq!(
            sanitized_rel_path("/_app/immutable/chunk.js"),
            Some(PathBuf::from("_app/immutable/chunk.js"))
        );
    }

    #[test]
    fn sanitized_rel_path_trims_a_trailing_slash() {
        assert_eq!(
            sanitized_rel_path("/about-me/"),
            Some(PathBuf::from("about-me"))
        );
    }

    #[test]
    fn sanitized_rel_path_rejects_dot_segments() {
        assert_eq!(sanitized_rel_path("/../secret"), None);
        assert_eq!(sanitized_rel_path("/.env"), None);
        assert_eq!(sanitized_rel_path("/foo/../bar"), None);
    }

    #[test]
    fn sanitized_rel_path_rejects_backslashes() {
        assert_eq!(sanitized_rel_path("/foo\\bar"), None);
    }

    #[test]
    fn sanitized_rel_path_rejects_empty_interior_segments() {
        // "/a//b" trims to "a//b", which splits into an empty middle segment.
        assert_eq!(sanitized_rel_path("/a//b"), None);
    }

    #[test]
    fn redirect_target_matches_resume_paths() {
        assert_eq!(redirect_target("/resume"), Some("/about-me"));
        assert_eq!(redirect_target("/live-resume"), Some("/about-me"));
    }

    #[test]
    fn redirect_target_trims_a_trailing_slash() {
        assert_eq!(redirect_target("/resume/"), Some("/about-me"));
        assert_eq!(redirect_target("/live-resume/"), Some("/about-me"));
    }

    #[test]
    fn redirect_target_ignores_unrelated_paths() {
        assert_eq!(redirect_target("/about-me"), None);
        assert_eq!(redirect_target("/resumewriting"), None);
    }

    #[test]
    fn resolve_target_matches_a_direct_file() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("robots.txt"), "hi").unwrap();

        assert_eq!(
            resolve_target("/robots.txt", dir.path()),
            (dir.path().join("robots.txt"), StatusCode::OK)
        );
    }

    #[test]
    fn resolve_target_falls_back_to_a_prerendered_html_page() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("about-me.html"), "hi").unwrap();

        assert_eq!(
            resolve_target("/about-me", dir.path()),
            (dir.path().join("about-me.html"), StatusCode::OK)
        );
    }

    #[test]
    fn resolve_target_prefers_a_direct_file_over_the_html_variant() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("about-me"), "direct").unwrap();
        fs::write(dir.path().join("about-me.html"), "html").unwrap();

        assert_eq!(
            resolve_target("/about-me", dir.path()),
            (dir.path().join("about-me"), StatusCode::OK)
        );
    }

    #[test]
    fn resolve_target_serves_the_index_for_the_root_path() {
        let dir = tempfile::tempdir().unwrap();

        assert_eq!(
            resolve_target("/", dir.path()),
            (dir.path().join("index.html"), StatusCode::OK)
        );
    }

    #[test]
    fn resolve_target_returns_a_404_for_unknown_routes() {
        let dir = tempfile::tempdir().unwrap();

        assert_eq!(
            resolve_target("/nothing-here", dir.path()),
            (dir.path().join("404.html"), StatusCode::NOT_FOUND)
        );
    }

    #[test]
    fn resolve_target_returns_a_404_for_an_unsafe_path() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            resolve_target("/../../etc/passwd", dir.path()),
            (dir.path().join("404.html"), StatusCode::NOT_FOUND)
        );
    }

    #[test]
    fn encoding_allowed_accepts_a_listed_encoding() {
        assert!(encoding_allowed("gzip, br", "br"));
        assert!(encoding_allowed("gzip, br", "gzip"));
    }

    #[test]
    fn encoding_allowed_rejects_an_unlisted_encoding() {
        assert!(!encoding_allowed("gzip", "br"));
        assert!(!encoding_allowed("", "br"));
    }

    #[test]
    fn encoding_allowed_is_case_insensitive() {
        assert!(encoding_allowed("GZIP", "gzip"));
    }

    #[test]
    fn encoding_allowed_rejects_a_q_zero_encoding() {
        assert!(!encoding_allowed("br;q=0", "br"));
        assert!(!encoding_allowed("br; q=0.0", "br"));
    }

    #[test]
    fn encoding_allowed_accepts_a_nonzero_q_value() {
        assert!(encoding_allowed("br;q=0.5", "br"));
    }

    #[test]
    fn precompressed_variant_prefers_brotli_over_gzip() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("robots.txt");
        fs::write(format!("{}.br", target.display()), "br").unwrap();
        fs::write(format!("{}.gz", target.display()), "gz").unwrap();

        let (path, encoding) = precompressed_variant(&target, "gzip, br").unwrap();
        assert_eq!(path, dir.path().join("robots.txt.br"));
        assert_eq!(encoding, ContentEncoding::Brotli);
    }

    #[test]
    fn precompressed_variant_falls_back_to_gzip_when_brotli_is_not_accepted() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("robots.txt");
        fs::write(format!("{}.br", target.display()), "br").unwrap();
        fs::write(format!("{}.gz", target.display()), "gz").unwrap();

        let (path, encoding) = precompressed_variant(&target, "gzip").unwrap();
        assert_eq!(path, dir.path().join("robots.txt.gz"));
        assert_eq!(encoding, ContentEncoding::Gzip);
    }

    #[test]
    fn precompressed_variant_is_none_when_nothing_is_accepted() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("robots.txt");
        fs::write(format!("{}.br", target.display()), "br").unwrap();

        assert!(precompressed_variant(&target, "identity").is_none());
    }

    #[test]
    fn precompressed_variant_is_none_when_no_variant_file_exists() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("robots.txt");

        assert!(precompressed_variant(&target, "gzip, br").is_none());
    }

    #[actix_web::test]
    async fn serve_rejects_non_get_head_methods() {
        let req = TestRequest::post().uri("/").to_http_request();
        let res = serve(req, test_tracker()).await.unwrap();
        assert_eq!(res.status(), StatusCode::METHOD_NOT_ALLOWED);
        assert_eq!(res.headers().get(header::ALLOW).unwrap(), "GET, HEAD");
    }

    #[actix_web::test]
    async fn serve_returns_the_fixture_index_page() {
        let req = TestRequest::get().uri("/").to_http_request();
        let res = serve(req, test_tracker()).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(
            res.headers().get(header::CACHE_CONTROL).unwrap(),
            "no-cache"
        );
        assert_eq!(
            res.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/html; charset=utf-8"
        );
    }

    #[actix_web::test]
    async fn serve_returns_a_prerendered_page_for_a_known_route() {
        let req = TestRequest::get().uri("/about-me").to_http_request();
        let res = serve(req, test_tracker()).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(
            res.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/html; charset=utf-8"
        );
    }

    #[actix_web::test]
    async fn serve_redirects_resume_to_about_me() {
        let req = TestRequest::get().uri("/resume").to_http_request();
        let res = serve(req, test_tracker()).await.unwrap();
        assert_eq!(res.status(), StatusCode::MOVED_PERMANENTLY);
        assert_eq!(res.headers().get(header::LOCATION).unwrap(), "/about-me");
    }

    #[actix_web::test]
    async fn serve_redirects_live_resume_to_about_me() {
        let req = TestRequest::get().uri("/live-resume").to_http_request();
        let res = serve(req, test_tracker()).await.unwrap();
        assert_eq!(res.status(), StatusCode::MOVED_PERMANENTLY);
        assert_eq!(res.headers().get(header::LOCATION).unwrap(), "/about-me");
    }

    #[actix_web::test]
    async fn serve_returns_a_404_for_an_unknown_route() {
        let req = TestRequest::get()
            .uri("/totally/unknown/route")
            .to_http_request();
        let res = serve(req, test_tracker()).await.unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
        assert_eq!(
            res.headers().get(header::CACHE_CONTROL).unwrap(),
            "no-cache"
        );
        assert_eq!(
            res.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/html; charset=utf-8"
        );
    }

    #[actix_web::test]
    async fn serve_does_not_record_a_visit_for_an_unknown_route() {
        let (sender, mut rx) = tokio::sync::mpsc::channel(8);
        let tracker = web::Data::new(VisitorTracker {
            sender,
            hash_secret: std::sync::Arc::new(vec![0u8; 32]),
        });
        let req =
            with_peer_addr(TestRequest::get().uri("/totally/unknown/route")).to_http_request();

        let res = serve(req, tracker).await.unwrap();

        assert_eq!(res.status(), StatusCode::NOT_FOUND);
        assert!(rx.try_recv().is_err());
    }

    #[actix_web::test]
    async fn serve_marks_hashed_app_chunks_as_immutable() {
        let req = TestRequest::get()
            .uri("/_app/immutable/chunk.js")
            .to_http_request();
        let res = serve(req, test_tracker()).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(
            res.headers().get(header::CACHE_CONTROL).unwrap(),
            "public, max-age=31536000, immutable"
        );
    }

    #[actix_web::test]
    async fn serve_uses_a_short_cache_for_a_plain_asset() {
        let req = TestRequest::get().uri("/robots.txt").to_http_request();
        let res = serve(req, test_tracker()).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(
            res.headers().get(header::CACHE_CONTROL).unwrap(),
            "public, max-age=3600"
        );
        assert!(res.headers().get(header::CONTENT_ENCODING).is_none());
    }

    #[actix_web::test]
    async fn serve_prefers_the_brotli_variant_when_accepted() {
        let req = TestRequest::get()
            .uri("/robots.txt")
            .insert_header((header::ACCEPT_ENCODING, "gzip, br"))
            .to_http_request();
        let res = serve(req, test_tracker()).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(res.headers().get(header::CONTENT_ENCODING).unwrap(), "br");
        // Content type must reflect the original file, not the .br variant.
        assert_eq!(
            res.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/plain; charset=utf-8"
        );
        assert_eq!(res.headers().get(header::VARY).unwrap(), "accept-encoding");
    }

    #[actix_web::test]
    async fn serve_falls_back_to_gzip_when_brotli_is_not_accepted() {
        let req = TestRequest::get()
            .uri("/robots.txt")
            .insert_header((header::ACCEPT_ENCODING, "gzip"))
            .to_http_request();
        let res = serve(req, test_tracker()).await.unwrap();
        assert_eq!(res.headers().get(header::CONTENT_ENCODING).unwrap(), "gzip");
    }

    fn tracker_with_receiver() -> (VisitorTracker, tokio::sync::mpsc::Receiver<ShortTermVisit>) {
        let (sender, rx) = tokio::sync::mpsc::channel(8);
        (
            VisitorTracker {
                sender,
                hash_secret: std::sync::Arc::new(vec![0u8; 32]),
            },
            rx,
        )
    }

    #[test]
    fn record_page_view_sends_an_event_for_an_html_get_with_a_known_peer() {
        let (tracker, mut rx) = tracker_with_receiver();
        let req = with_peer_addr(TestRequest::get().uri("/about-me")).to_http_request();

        record_page_view(&req, true, StatusCode::OK, &tracker);

        let event = rx.try_recv().expect("expected a recorded visit");
        assert_eq!(event.path, "/about-me");
    }

    #[test]
    fn record_page_view_does_nothing_for_a_non_html_response() {
        let (tracker, mut rx) = tracker_with_receiver();
        let req = with_peer_addr(TestRequest::get().uri("/robots.txt")).to_http_request();

        record_page_view(&req, false, StatusCode::OK, &tracker);

        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn record_page_view_does_nothing_for_a_head_request() {
        let (tracker, mut rx) = tracker_with_receiver();
        let req =
            with_peer_addr(TestRequest::default().method(Method::HEAD).uri("/")).to_http_request();

        record_page_view(&req, true, StatusCode::OK, &tracker);

        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn record_page_view_does_nothing_without_a_peer_address() {
        let (tracker, mut rx) = tracker_with_receiver();
        let req = TestRequest::get().uri("/").to_http_request();

        record_page_view(&req, true, StatusCode::OK, &tracker);

        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn record_page_view_does_nothing_for_a_404() {
        let (tracker, mut rx) = tracker_with_receiver();
        let req = with_peer_addr(TestRequest::get().uri("/nothing-here")).to_http_request();

        record_page_view(&req, true, StatusCode::NOT_FOUND, &tracker);

        assert!(rx.try_recv().is_err());
    }
}
