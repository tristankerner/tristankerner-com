use actix_web::HttpRequest;
use actix_web::http::header;
use chrono::NaiveDate;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use std::net::IpAddr;

type HmacSha256 = Hmac<Sha256>;

// Derives a per-day visitor identifier from the client's IP + User-Agent,
// HMAC'd with a per-deployment secret (see store::load_or_create_hash_secret)
// rather than hashed bare - a bare hash of an IP is trivially brute-forced
// given how small the IPv4 space is, so it wouldn't actually protect
// anyone whose hands the sqlite file ends up in. Folding the day into the
// input also means the same visitor gets an unrelated-looking key every
// day, so the persisted key can't be used to build a cross-day profile of
// a given IP/UA.
pub(crate) fn derive(secret: &[u8], ip: &str, user_agent: &str, day: NaiveDate) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret).expect("HMAC-SHA256 accepts a key of any length");
    // NUL-separated so e.g. ip="1.2.3." + ua="45" can't collide with
    // ip="1.2.3.4" + ua="5".
    let message = format!("{ip}\0{user_agent}\0{day}");
    mac.update(message.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

// Reads the real client IP, accounting for a Cloudflare-proxied deployment
// (see the README's "Running behind Cloudflare" note). Trusting a
// client-suppliable header for this is a genuine spoofing risk *unless*
// the origin only ever accepts connections that actually came through
// Cloudflare - so this only consults CF-Connecting-IP when
// TRUST_CF_CONNECTING_IP=true is explicitly set, which the operator should
// only do after also restricting inbound traffic to Cloudflare's published
// IP ranges (https://www.cloudflare.com/ips/). Left unset (the default),
// this behaves exactly as when there's no proxy at all: the observed TCP
// peer address is used, which can't be spoofed by the client itself.
pub(crate) fn client_ip(req: &HttpRequest) -> Option<String> {
    if trust_cf_connecting_ip()
        && let Some(ip) = cf_connecting_ip(req)
    {
        return Some(ip);
    }
    req.peer_addr().map(|addr| addr.ip().to_string())
}

fn trust_cf_connecting_ip() -> bool {
    std::env::var("TRUST_CF_CONNECTING_IP").is_ok_and(|value| value == "true")
}

// Parses (and so also validates/normalizes) the header value rather than
// trusting it as an opaque string - a malformed or absent header falls
// back to the peer address via the caller, the same as if the header were
// never sent.
fn cf_connecting_ip(req: &HttpRequest) -> Option<String> {
    req.headers()
        .get("CF-Connecting-IP")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse::<IpAddr>().ok())
        .map(|ip| ip.to_string())
}

pub(crate) fn user_agent(req: &HttpRequest) -> &str {
    req.headers()
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test::TestRequest;
    use serial_test::serial;
    use std::net::SocketAddr;

    fn day() -> NaiveDate {
        NaiveDate::parse_from_str("2026-01-01", "%Y-%m-%d").unwrap()
    }

    #[test]
    fn derive_is_deterministic_for_the_same_inputs() {
        let secret = b"test-secret";
        assert_eq!(
            derive(secret, "1.2.3.4", "curl/8.0", day()),
            derive(secret, "1.2.3.4", "curl/8.0", day())
        );
    }

    #[test]
    fn derive_differs_for_a_different_ip() {
        let secret = b"test-secret";
        assert_ne!(
            derive(secret, "1.2.3.4", "curl/8.0", day()),
            derive(secret, "5.6.7.8", "curl/8.0", day())
        );
    }

    #[test]
    fn derive_differs_for_a_different_user_agent() {
        let secret = b"test-secret";
        assert_ne!(
            derive(secret, "1.2.3.4", "curl/8.0", day()),
            derive(secret, "1.2.3.4", "curl/9.0", day())
        );
    }

    #[test]
    fn derive_differs_for_a_different_day() {
        let secret = b"test-secret";
        let other_day = NaiveDate::parse_from_str("2026-01-02", "%Y-%m-%d").unwrap();
        assert_ne!(
            derive(secret, "1.2.3.4", "curl/8.0", day()),
            derive(secret, "1.2.3.4", "curl/8.0", other_day)
        );
    }

    #[test]
    fn derive_differs_for_a_different_secret() {
        assert_ne!(
            derive(b"secret-a", "1.2.3.4", "curl/8.0", day()),
            derive(b"secret-b", "1.2.3.4", "curl/8.0", day())
        );
    }

    #[test]
    fn derive_does_not_let_ip_and_user_agent_bytes_collide_across_the_boundary() {
        let secret = b"test-secret";
        assert_ne!(
            derive(secret, "1.2.3.", "45", day()),
            derive(secret, "1.2.3.4", "5", day())
        );
    }

    #[test]
    fn derive_returns_a_64_character_hex_string() {
        let key = derive(b"test-secret", "1.2.3.4", "curl/8.0", day());
        assert_eq!(key.len(), 64);
        assert!(key.chars().all(|c| c.is_ascii_hexdigit()));
    }

    fn set_env(key: &str, value: &str) {
        unsafe { std::env::set_var(key, value) };
    }

    fn remove_env(key: &str) {
        unsafe { std::env::remove_var(key) };
    }

    fn peer_addr_req() -> TestRequest {
        let addr: SocketAddr = "203.0.113.5:12345".parse().unwrap();
        TestRequest::default().peer_addr(addr)
    }

    #[test]
    fn client_ip_reads_the_peer_address() {
        let req = peer_addr_req().to_http_request();
        assert_eq!(client_ip(&req).as_deref(), Some("203.0.113.5"));
    }

    #[test]
    fn client_ip_is_none_without_a_peer_address() {
        let req = TestRequest::default().to_http_request();
        assert_eq!(client_ip(&req), None);
    }

    #[test]
    #[serial(trust_cf_ip_env)]
    fn client_ip_ignores_cf_connecting_ip_when_not_trusted() {
        remove_env("TRUST_CF_CONNECTING_IP");
        let req = peer_addr_req()
            .insert_header(("CF-Connecting-IP", "198.51.100.7"))
            .to_http_request();

        // Falls back to the peer address, not the (untrusted) header.
        assert_eq!(client_ip(&req).as_deref(), Some("203.0.113.5"));
    }

    #[test]
    #[serial(trust_cf_ip_env)]
    fn client_ip_prefers_cf_connecting_ip_when_trusted() {
        set_env("TRUST_CF_CONNECTING_IP", "true");
        let req = peer_addr_req()
            .insert_header(("CF-Connecting-IP", "198.51.100.7"))
            .to_http_request();

        let result = client_ip(&req);
        remove_env("TRUST_CF_CONNECTING_IP");

        assert_eq!(result.as_deref(), Some("198.51.100.7"));
    }

    #[test]
    #[serial(trust_cf_ip_env)]
    fn client_ip_falls_back_to_peer_addr_when_trusted_but_header_is_absent() {
        set_env("TRUST_CF_CONNECTING_IP", "true");
        let req = peer_addr_req().to_http_request();

        let result = client_ip(&req);
        remove_env("TRUST_CF_CONNECTING_IP");

        assert_eq!(result.as_deref(), Some("203.0.113.5"));
    }

    #[test]
    #[serial(trust_cf_ip_env)]
    fn client_ip_falls_back_to_peer_addr_when_trusted_but_header_is_malformed() {
        set_env("TRUST_CF_CONNECTING_IP", "true");
        let req = peer_addr_req()
            .insert_header(("CF-Connecting-IP", "not-an-ip"))
            .to_http_request();

        let result = client_ip(&req);
        remove_env("TRUST_CF_CONNECTING_IP");

        assert_eq!(result.as_deref(), Some("203.0.113.5"));
    }

    #[test]
    #[serial(trust_cf_ip_env)]
    fn client_ip_normalizes_the_trusted_header_value() {
        set_env("TRUST_CF_CONNECTING_IP", "true");
        // IPv6 addresses have multiple valid textual forms; parsing and
        // re-formatting via IpAddr gives a single canonical one.
        let req = peer_addr_req()
            .insert_header((
                "CF-Connecting-IP",
                "2001:0db8:0000:0000:0000:0000:0000:0001",
            ))
            .to_http_request();

        let result = client_ip(&req);
        remove_env("TRUST_CF_CONNECTING_IP");

        assert_eq!(result.as_deref(), Some("2001:db8::1"));
    }

    #[test]
    fn user_agent_reads_the_header() {
        let req = TestRequest::default()
            .insert_header((header::USER_AGENT, "curl/8.0"))
            .to_http_request();
        assert_eq!(user_agent(&req), "curl/8.0");
    }

    #[test]
    fn user_agent_defaults_to_empty_when_missing() {
        let req = TestRequest::default().to_http_request();
        assert_eq!(user_agent(&req), "");
    }
}
