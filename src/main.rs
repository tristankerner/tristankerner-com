mod ga4;
mod static_files;
mod tls;
mod ws_counter;

use actix_web::http::header;
use actix_web::{App, HttpServer, middleware, web};

// Total simultaneous TCP connections accepted per worker. The actix default
// (25k) is sized for big machines; keep it under a typical 1024 fd ulimit so
// overload degrades into refused connections instead of accept errors.
const MAX_CONNECTIONS: usize = 768;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Missing .env is fine (e.g. the Docker image, which gets config purely
    // via -e/--env-file); an actually malformed one should fail loudly.
    if let Err(e) = dotenvy::dotenv()
        && !e.not_found()
    {
        panic!("failed to load .env: {e}");
    }

    let tx = web::Data::new(ws_counter::start());

    let tls_config = tls::server_config()?;
    let tls_enabled = tls_config.is_some();

    let mut server = HttpServer::new(move || {
        // Only add headers the statically generated pages can't set themselves.
        // HSTS is only safe to send once this process is actually the one
        // terminating TLS - otherwise it'd tell browsers to require HTTPS for a
        // deployment that only ever serves plain HTTP.
        let mut headers = middleware::DefaultHeaders::new()
            .add((header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
            .add((header::X_FRAME_OPTIONS, "DENY"))
            .add((header::REFERRER_POLICY, "strict-origin-when-cross-origin"));
        if tls_enabled {
            headers = headers.add((
                header::STRICT_TRANSPORT_SECURITY,
                "max-age=31536000; includeSubDomains",
            ));
        }

        App::new()
            .app_data(tx.clone())
            .wrap(headers)
            .route("/ws-counter", web::get().to(ws_counter::handle))
            // Everything else is the static SvelteKit build (assets, prerendered
            // pages, SPA-shell fallback), with precompressed variants and caching.
            .default_service(web::to(static_files::serve))
    })
    .max_connections(MAX_CONNECTIONS);

    server = match tls_config {
        Some(config) => server.bind_rustls_0_23((bind_host(), tls::port()), config)?,
        None => server.bind((bind_host(), bind_port()))?,
    };
    let app_run = server.run();

    if !tls_enabled {
        return app_run.await;
    }

    let redirect_run =
        HttpServer::new(|| App::new().default_service(web::to(tls::redirect_to_https)))
            .max_connections(MAX_CONNECTIONS)
            .bind((bind_host(), bind_port()))?
            .run();

    tokio::try_join!(app_run, redirect_run)?;
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    // HOST/PORT are process-wide env vars shared by every test here, hence
    // #[serial] plus the unsafe wrappers (set_var/remove_var are unsafe as of
    // the 2024 edition).
    fn set_env(key: &str, value: &str) {
        unsafe { std::env::set_var(key, value) };
    }

    fn remove_env(key: &str) {
        unsafe { std::env::remove_var(key) };
    }

    #[test]
    #[serial(bind_env)]
    fn bind_host_defaults_to_loopback() {
        remove_env("HOST");
        assert_eq!(bind_host(), "127.0.0.1");
    }

    #[test]
    #[serial(bind_env)]
    fn bind_host_reads_the_env_override() {
        set_env("HOST", "0.0.0.0");
        assert_eq!(bind_host(), "0.0.0.0");
        remove_env("HOST");
    }

    #[test]
    #[serial(bind_env)]
    fn bind_port_defaults_to_8080() {
        remove_env("PORT");
        assert_eq!(bind_port(), 8080);
    }

    #[test]
    #[serial(bind_env)]
    fn bind_port_reads_the_env_override() {
        set_env("PORT", "3000");
        assert_eq!(bind_port(), 3000);
        remove_env("PORT");
    }

    #[test]
    #[serial(bind_env)]
    fn bind_port_falls_back_to_8080_for_an_invalid_value() {
        set_env("PORT", "not-a-port");
        assert_eq!(bind_port(), 8080);
        remove_env("PORT");
    }
}
