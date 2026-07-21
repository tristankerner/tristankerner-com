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

impl ResolvesServerCert for ReloadingCertResolver {
    fn resolve(&self, _client_hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
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
