use actix_files::NamedFile;
use actix_web::http::Method;
use actix_web::http::header::{self, ContentEncoding, HeaderValue};
use actix_web::{HttpRequest, HttpResponse, Result};
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
//
// Takes `build_dir` explicitly (rather than reading BUILD_DIR itself) so
// tests can point it at a throwaway directory instead of the real build
// output.
fn resolve_target(request_path: &str, build_dir: &Path) -> PathBuf {
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

pub(crate) async fn serve(req: HttpRequest) -> Result<HttpResponse> {
    if !matches!(*req.method(), Method::GET | Method::HEAD) {
        return Ok(HttpResponse::MethodNotAllowed()
            .insert_header((header::ALLOW, "GET, HEAD"))
            .finish());
    }

    let target = resolve_target(req.path(), Path::new(BUILD_DIR));
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
    res.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(cache_control),
    );
    Ok(res)
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::http::StatusCode;
    use actix_web::test::TestRequest;
    use std::fs;

    #[test]
    fn sanitized_rel_path_rejects_the_root() {
        assert_eq!(sanitized_rel_path("/"), None);
        assert_eq!(sanitized_rel_path(""), None);
    }

    #[test]
    fn sanitized_rel_path_accepts_a_simple_path() {
        assert_eq!(sanitized_rel_path("/about-me"), Some(PathBuf::from("about-me")));
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
        assert_eq!(sanitized_rel_path("/about-me/"), Some(PathBuf::from("about-me")));
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
    fn resolve_target_matches_a_direct_file() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("robots.txt"), "hi").unwrap();

        assert_eq!(
            resolve_target("/robots.txt", dir.path()),
            dir.path().join("robots.txt")
        );
    }

    #[test]
    fn resolve_target_falls_back_to_a_prerendered_html_page() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("about-me.html"), "hi").unwrap();

        assert_eq!(
            resolve_target("/about-me", dir.path()),
            dir.path().join("about-me.html")
        );
    }

    #[test]
    fn resolve_target_prefers_a_direct_file_over_the_html_variant() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("about-me"), "direct").unwrap();
        fs::write(dir.path().join("about-me.html"), "html").unwrap();

        assert_eq!(
            resolve_target("/about-me", dir.path()),
            dir.path().join("about-me")
        );
    }

    #[test]
    fn resolve_target_falls_back_to_the_spa_shell_for_unknown_routes() {
        let dir = tempfile::tempdir().unwrap();

        assert_eq!(
            resolve_target("/nothing-here", dir.path()),
            dir.path().join("index.html")
        );
    }

    #[test]
    fn resolve_target_falls_back_to_the_spa_shell_for_an_unsafe_path() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            resolve_target("/../../etc/passwd", dir.path()),
            dir.path().join("index.html")
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
        let res = serve(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::METHOD_NOT_ALLOWED);
        assert_eq!(res.headers().get(header::ALLOW).unwrap(), "GET, HEAD");
    }

    #[actix_web::test]
    async fn serve_returns_the_fixture_index_page() {
        let req = TestRequest::get().uri("/").to_http_request();
        let res = serve(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(res.headers().get(header::CACHE_CONTROL).unwrap(), "no-cache");
        assert_eq!(res.headers().get(header::CONTENT_TYPE).unwrap(), "text/html; charset=utf-8");
    }

    #[actix_web::test]
    async fn serve_returns_a_prerendered_page_for_a_known_route() {
        let req = TestRequest::get().uri("/about-me").to_http_request();
        let res = serve(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(res.headers().get(header::CONTENT_TYPE).unwrap(), "text/html; charset=utf-8");
    }

    #[actix_web::test]
    async fn serve_falls_back_to_the_spa_shell_for_an_unknown_route() {
        let req = TestRequest::get().uri("/totally/unknown/route").to_http_request();
        let res = serve(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(res.headers().get(header::CACHE_CONTROL).unwrap(), "no-cache");
    }

    #[actix_web::test]
    async fn serve_marks_hashed_app_chunks_as_immutable() {
        let req = TestRequest::get()
            .uri("/_app/immutable/chunk.js")
            .to_http_request();
        let res = serve(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(
            res.headers().get(header::CACHE_CONTROL).unwrap(),
            "public, max-age=31536000, immutable"
        );
    }

    #[actix_web::test]
    async fn serve_uses_a_short_cache_for_a_plain_asset() {
        let req = TestRequest::get().uri("/robots.txt").to_http_request();
        let res = serve(req).await.unwrap();
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
        let res = serve(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(res.headers().get(header::CONTENT_ENCODING).unwrap(), "br");
        // Content type must reflect the original file, not the .br variant.
        assert_eq!(res.headers().get(header::CONTENT_TYPE).unwrap(), "text/plain; charset=utf-8");
        assert_eq!(res.headers().get(header::VARY).unwrap(), "accept-encoding");
    }

    #[actix_web::test]
    async fn serve_falls_back_to_gzip_when_brotli_is_not_accepted() {
        let req = TestRequest::get()
            .uri("/robots.txt")
            .insert_header((header::ACCEPT_ENCODING, "gzip"))
            .to_http_request();
        let res = serve(req).await.unwrap();
        assert_eq!(res.headers().get(header::CONTENT_ENCODING).unwrap(), "gzip");
    }
}
