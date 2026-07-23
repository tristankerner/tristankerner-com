mod ga4;
mod static_files;
mod store;
mod tls;
mod visitor_key;
mod ws_counter;

use actix_web::http::header;
use actix_web::{App, HttpServer, middleware, web};
use std::path::PathBuf;
use std::sync::Arc;

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
    // After dotenv, so a RUST_LOG set in .env takes effect. env_logger
    // prints nothing at all if RUST_LOG is unset (see the Dockerfile, which
    // sets a default of "info" for the production image).
    env_logger::init();

    let db_path = visitor_db_path();
    // Unlike TLS/GA4 (opt-in features that degrade to "off" when
    // unconfigured), the visitor database is core, always-on infrastructure
    // for the counter feature - a setup failure here (bad permissions, a
    // corrupt file, a full disk) is an environment problem the operator
    // should see immediately, not something to silently serve a broken
    // counter around.
    let db_conn = store::open(&db_path)
        .unwrap_or_else(|e| panic!("failed to open the visitor database at {db_path:?}: {e}"));
    let hash_secret = Arc::new(
        store::load_or_create_hash_secret(&db_conn)
            .unwrap_or_else(|e| panic!("failed to load the visitor hash secret: {e}")),
    );
    drop(db_conn);

    // Shared between the short-term writer, the daily GA4 sync, and the
    // combined-total ticker (all in different tasks/modules) so any of them
    // can wake the ticker up between its scheduled ticks - see
    // ws_counter::spawn_combined_ticker.
    let refresh = Arc::new(tokio::sync::Notify::new());

    let tracker = web::Data::new(store::VisitorTracker {
        sender: store::spawn_writer(db_path.clone(), refresh.clone()),
        hash_secret,
    });
    let tx = web::Data::new(ws_counter::start(db_path, refresh.clone()));
    let refresh = web::Data::new(refresh);

    let tls_config = tls::server_config()?;
    let tls_enabled = tls_config.is_some();

    // A `docker logs` right after a deploy should confirm the config that
    // was actually picked up, not just that the process is alive.
    log::info!(
        "starting: host={}, port={}, tls={}",
        bind_host(),
        bind_port(),
        if tls_enabled {
            format!("enabled (https port {})", tls::port())
        } else {
            "disabled".to_string()
        }
    );

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
            .app_data(tracker.clone())
            .app_data(refresh.clone())
            .wrap(headers)
            // Outermost, so it times/logs the full request including the
            // headers middleware above. Access logs are gated behind
            // RUST_LOG the same as this crate's own log calls (see
            // env_logger::init() above) - unset means silent, matching the
            // pre-existing default.
            .wrap(middleware::Logger::default())
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

// Defaults to a file in the working directory for local dev; the Docker
// image and deploy/run.sh point this at a mounted, persistent volume so the
// visitor counts survive container restarts and redeploys (see
// src/store.rs).
fn visitor_db_path() -> PathBuf {
    std::env::var("VISITOR_DB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("./visitors.db"))
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

    #[test]
    #[serial(visitor_db_env)]
    fn visitor_db_path_defaults_to_a_local_file() {
        remove_env("VISITOR_DB_PATH");
        assert_eq!(visitor_db_path(), PathBuf::from("./visitors.db"));
    }

    #[test]
    #[serial(visitor_db_env)]
    fn visitor_db_path_reads_the_env_override() {
        set_env("VISITOR_DB_PATH", "/data/visitors.db");
        assert_eq!(visitor_db_path(), PathBuf::from("/data/visitors.db"));
        remove_env("VISITOR_DB_PATH");
    }
}
