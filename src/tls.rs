use actix_web::http::header;
use actix_web::{HttpRequest, HttpResponse};
use rustls::ServerConfig;
use rustls::crypto::CryptoProvider;
use rustls::pki_types::CertificateDer;
use rustls::server::{ClientHello, ResolvesServerCert};
use rustls::sign::CertifiedKey;
use std::fs::{self, File};
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::SystemTime;

// Re-reads the cert/key pair from disk when the cert file's mtime changes, so
// a certbot renewal writing into the mounted volume is picked up on the next
// TLS handshake without restarting the server.
#[derive(Debug)]
struct ReloadingCertResolver {
    cert_path: PathBuf,
    key_path: PathBuf,
    provider: Arc<CryptoProvider>,
    cached: RwLock<(SystemTime, Arc<CertifiedKey>)>,
}

impl ReloadingCertResolver {
    fn new(
        cert_path: PathBuf,
        key_path: PathBuf,
        provider: Arc<CryptoProvider>,
    ) -> std::io::Result<Self> {
        let key = load_certified_key(&cert_path, &key_path, &provider)?;
        let mtime = fs::metadata(&cert_path)?.modified()?;
        Ok(Self {
            cert_path,
            key_path,
            provider,
            cached: RwLock::new((mtime, Arc::new(key))),
        })
    }
}

fn load_certified_key(
    cert_path: &Path,
    key_path: &Path,
    provider: &CryptoProvider,
) -> std::io::Result<CertifiedKey> {
    let cert_chain: Vec<CertificateDer<'static>> =
        rustls_pemfile::certs(&mut BufReader::new(File::open(cert_path)?))
            .collect::<Result<_, _>>()?;
    let key = rustls_pemfile::private_key(&mut BufReader::new(File::open(key_path)?))?.ok_or_else(
        || {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("no private key found in {key_path:?}"),
            )
        },
    )?;
    CertifiedKey::from_der(cert_chain, key, provider)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
}

impl ReloadingCertResolver {
    // The actual cache/reload logic, split out from `resolve` because
    // `ClientHello` has no public constructor - this way tests can drive it
    // directly without a real TLS handshake.
    fn resolve_cached(&self) -> Option<Arc<CertifiedKey>> {
        let current_mtime = fs::metadata(&self.cert_path)
            .and_then(|m| m.modified())
            .ok();

        if let Some(current_mtime) = current_mtime
            && let Ok(cached) = self.cached.read()
            && cached.0 == current_mtime
        {
            return Some(cached.1.clone());
        }

        match load_certified_key(&self.cert_path, &self.key_path, &self.provider) {
            Ok(key) => {
                let key = Arc::new(key);
                if let (Some(mtime), Ok(mut cached)) = (current_mtime, self.cached.write()) {
                    *cached = (mtime, key.clone());
                }
                Some(key)
            }
            // certbot renewal isn't atomic across the two files; on a transient
            // read/parse failure keep serving the last good cert rather than
            // dropping the handshake.
            Err(_) => self.cached.read().ok().map(|cached| cached.1.clone()),
        }
    }
}

impl ResolvesServerCert for ReloadingCertResolver {
    fn resolve(&self, _client_hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
        self.resolve_cached()
    }
}

// TLS is opt-in: set TLS_CERT_PATH/TLS_KEY_PATH (e.g. to a certbot
// live/<domain>/{fullchain,privkey}.pem mounted read-only) to serve HTTPS on
// TLS_PORT. Leaving them unset preserves the plain-HTTP-only behavior.
pub(crate) fn server_config() -> std::io::Result<Option<ServerConfig>> {
    // Blank counts as unset too, since .env ships these keys present but
    // commented/empty by default.
    let cert_path = std::env::var("TLS_CERT_PATH")
        .ok()
        .filter(|s| !s.is_empty());
    let key_path = std::env::var("TLS_KEY_PATH").ok().filter(|s| !s.is_empty());
    let (Some(cert_path), Some(key_path)) = (cert_path, key_path) else {
        return Ok(None);
    };

    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("crypto provider is installed exactly once, before any TLS config is built");
    let provider = CryptoProvider::get_default()
        .expect("just installed above")
        .clone();

    let resolver =
        ReloadingCertResolver::new(PathBuf::from(cert_path), PathBuf::from(key_path), provider)?;

    Ok(Some(
        ServerConfig::builder()
            .with_no_client_auth()
            .with_cert_resolver(Arc::new(resolver)),
    ))
}

pub(crate) fn port() -> u16 {
    std::env::var("TLS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(443)
}

// Plain-HTTP companion to the HTTPS listener: nothing but a redirect, mirroring
// the nginx `return 301 https://$host$request_uri;` pattern. Only run when TLS
// is enabled — without it, PORT/HOST already serve the real site over HTTP.
pub(crate) async fn redirect_to_https(req: HttpRequest) -> HttpResponse {
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    let host = host.split(':').next().unwrap_or(host);

    HttpResponse::MovedPermanently()
        .insert_header((header::LOCATION, format!("https://{host}{}", req.uri())))
        .finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::http::StatusCode;
    use actix_web::test::TestRequest;
    use serial_test::serial;
    use std::fs;
    use std::thread::sleep;
    use std::time::Duration;

    // std::env::set_var/remove_var are unsafe as of the 2024 edition (they're
    // not thread-safe against concurrent getenv elsewhere), and TLS_* env vars
    // are process-wide state shared by every test in this file - hence the
    // small unsafe wrappers plus #[serial] on every test that touches them.
    fn set_env(key: &str, value: &str) {
        unsafe { std::env::set_var(key, value) };
    }

    fn remove_env(key: &str) {
        unsafe { std::env::remove_var(key) };
    }

    fn clear_tls_env() {
        remove_env("TLS_CERT_PATH");
        remove_env("TLS_KEY_PATH");
        remove_env("TLS_PORT");
    }

    /// Writes a fresh self-signed cert/key pair into `dir`, returning
    /// (cert_path, key_path).
    fn write_cert_files(dir: &Path) -> (PathBuf, PathBuf) {
        let rcgen::CertifiedKey { cert, signing_key } =
            rcgen::generate_simple_self_signed(vec!["localhost".to_string()]).unwrap();
        let cert_path = dir.join("fullchain.pem");
        let key_path = dir.join("privkey.pem");
        fs::write(&cert_path, cert.pem()).unwrap();
        fs::write(&key_path, signing_key.serialize_pem()).unwrap();
        (cert_path, key_path)
    }

    #[test]
    #[serial(tls_env)]
    fn port_defaults_to_443() {
        clear_tls_env();
        assert_eq!(port(), 443);
    }

    #[test]
    #[serial(tls_env)]
    fn port_reads_the_env_override() {
        clear_tls_env();
        set_env("TLS_PORT", "8443");
        assert_eq!(port(), 8443);
        clear_tls_env();
    }

    #[test]
    #[serial(tls_env)]
    fn port_falls_back_to_443_for_an_invalid_value() {
        clear_tls_env();
        set_env("TLS_PORT", "not-a-port");
        assert_eq!(port(), 443);
        clear_tls_env();
    }

    #[test]
    #[serial(tls_env)]
    fn server_config_is_none_when_unset() {
        clear_tls_env();
        assert!(server_config().unwrap().is_none());
    }

    #[test]
    #[serial(tls_env)]
    fn server_config_is_none_when_blank() {
        clear_tls_env();
        set_env("TLS_CERT_PATH", "");
        set_env("TLS_KEY_PATH", "");
        assert!(server_config().unwrap().is_none());
        clear_tls_env();
    }

    #[test]
    #[serial(tls_env)]
    fn server_config_is_none_when_only_one_of_the_two_is_set() {
        clear_tls_env();
        set_env("TLS_CERT_PATH", "/some/path.pem");
        assert!(server_config().unwrap().is_none());
        clear_tls_env();
    }

    // The only test allowed to exercise the Some(..) path: it installs the
    // process-wide default crypto provider, which rustls only allows once per
    // process. Every other server_config() test above must stay on the
    // early-return None path so they don't race this one.
    #[test]
    #[serial(tls_env)]
    fn server_config_builds_a_config_from_valid_cert_and_key_paths() {
        clear_tls_env();
        let dir = tempfile::tempdir().unwrap();
        let (cert_path, key_path) = write_cert_files(dir.path());
        set_env("TLS_CERT_PATH", cert_path.to_str().unwrap());
        set_env("TLS_KEY_PATH", key_path.to_str().unwrap());

        let config = server_config().unwrap();
        assert!(config.is_some());

        clear_tls_env();
    }

    #[test]
    fn load_certified_key_succeeds_for_a_valid_pair() {
        let dir = tempfile::tempdir().unwrap();
        let (cert_path, key_path) = write_cert_files(dir.path());
        let provider = rustls::crypto::ring::default_provider();

        assert!(load_certified_key(&cert_path, &key_path, &provider).is_ok());
    }

    #[test]
    fn load_certified_key_fails_for_a_missing_cert_file() {
        let dir = tempfile::tempdir().unwrap();
        let (_cert_path, key_path) = write_cert_files(dir.path());
        let provider = rustls::crypto::ring::default_provider();

        let result = load_certified_key(&dir.path().join("missing.pem"), &key_path, &provider);
        assert!(result.is_err());
    }

    #[test]
    fn load_certified_key_fails_for_a_missing_key_file() {
        let dir = tempfile::tempdir().unwrap();
        let (cert_path, _key_path) = write_cert_files(dir.path());
        let provider = rustls::crypto::ring::default_provider();

        let result = load_certified_key(&cert_path, &dir.path().join("missing.pem"), &provider);
        assert!(result.is_err());
    }

    #[test]
    fn load_certified_key_fails_when_the_key_file_has_no_private_key() {
        let dir = tempfile::tempdir().unwrap();
        let (cert_path, _key_path) = write_cert_files(dir.path());
        let empty_key_path = dir.path().join("empty-key.pem");
        fs::write(&empty_key_path, "").unwrap();
        let provider = rustls::crypto::ring::default_provider();

        let err = load_certified_key(&cert_path, &empty_key_path, &provider).unwrap_err();
        assert!(err.to_string().contains("no private key found"));
    }

    #[test]
    fn load_certified_key_fails_for_malformed_cert_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let (_cert_path, key_path) = write_cert_files(dir.path());
        let bad_cert_path = dir.path().join("bad-cert.pem");
        fs::write(&bad_cert_path, "not a certificate").unwrap();
        let provider = rustls::crypto::ring::default_provider();

        assert!(load_certified_key(&bad_cert_path, &key_path, &provider).is_err());
    }

    #[test]
    fn reloading_cert_resolver_new_succeeds_for_a_valid_pair() {
        let dir = tempfile::tempdir().unwrap();
        let (cert_path, key_path) = write_cert_files(dir.path());
        let provider = Arc::new(rustls::crypto::ring::default_provider());

        assert!(ReloadingCertResolver::new(cert_path, key_path, provider).is_ok());
    }

    #[test]
    fn reloading_cert_resolver_new_fails_for_a_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let provider = Arc::new(rustls::crypto::ring::default_provider());

        let result = ReloadingCertResolver::new(
            dir.path().join("missing.pem"),
            dir.path().join("also-missing.pem"),
            provider,
        );
        assert!(result.is_err());
    }

    #[test]
    fn resolve_cached_reuses_the_cached_key_when_the_file_is_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let (cert_path, key_path) = write_cert_files(dir.path());
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let resolver = ReloadingCertResolver::new(cert_path, key_path, provider).unwrap();

        let first = resolver.resolve_cached().unwrap();
        let second = resolver.resolve_cached().unwrap();
        assert!(Arc::ptr_eq(&first, &second));
    }

    #[test]
    fn resolve_cached_reloads_when_the_cert_files_mtime_changes() {
        let dir = tempfile::tempdir().unwrap();
        let (cert_path, key_path) = write_cert_files(dir.path());
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let resolver =
            ReloadingCertResolver::new(cert_path.clone(), key_path.clone(), provider).unwrap();

        let first = resolver.resolve_cached().unwrap();

        // Give the filesystem's mtime clock room to actually advance before
        // rewriting the pair with a fresh cert (different key material).
        sleep(Duration::from_millis(20));
        write_cert_files(dir.path());

        let second = resolver.resolve_cached().unwrap();
        assert!(!Arc::ptr_eq(&first, &second));
    }

    #[test]
    fn resolve_cached_keeps_serving_the_last_good_key_on_a_transient_read_failure() {
        let dir = tempfile::tempdir().unwrap();
        let (cert_path, key_path) = write_cert_files(dir.path());
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let resolver =
            ReloadingCertResolver::new(cert_path.clone(), key_path.clone(), provider).unwrap();

        let first = resolver.resolve_cached().unwrap();

        // Bump the cert file's mtime (forcing a reload attempt) but leave it
        // holding unparsable content, simulating certbot's non-atomic
        // fullchain/privkey rewrite catching this resolver mid-update.
        sleep(Duration::from_millis(20));
        fs::write(&cert_path, "not a certificate").unwrap();

        let second = resolver.resolve_cached().unwrap();
        assert!(Arc::ptr_eq(&first, &second));
    }

    #[actix_web::test]
    async fn redirect_to_https_strips_the_port_from_host() {
        let req = TestRequest::get()
            .uri("/some/path?x=1")
            .insert_header((header::HOST, "example.com:8080"))
            .to_http_request();

        let res = redirect_to_https(req).await;
        assert_eq!(res.status(), StatusCode::MOVED_PERMANENTLY);
        assert_eq!(
            res.headers().get(header::LOCATION).unwrap(),
            "https://example.com/some/path?x=1"
        );
    }

    #[actix_web::test]
    async fn redirect_to_https_tolerates_a_missing_host_header() {
        let req = TestRequest::get().uri("/").to_http_request();

        let res = redirect_to_https(req).await;
        assert_eq!(res.status(), StatusCode::MOVED_PERMANENTLY);
        assert_eq!(res.headers().get(header::LOCATION).unwrap(), "https:///");
    }
}
