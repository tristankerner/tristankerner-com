use actix_files::NamedFile;
use actix_web::http::Method;
use actix_web::http::header::{self, ContentEncoding, HeaderValue};
use actix_web::{HttpRequest, HttpResponse, Result};
use std::path::{Path, PathBuf};

const BUILD_DIR: &str = "./frontend/build";

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

pub(crate) async fn serve(req: HttpRequest) -> Result<HttpResponse> {
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
    res.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(cache_control),
    );
    Ok(res)
}
