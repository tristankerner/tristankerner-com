use gcp_auth::{CustomServiceAccount, TokenProvider};
use google_analytics_api_ga4::types::{DateRange, Dimension, Metric, OrderBy, RunReportResponse};
use google_analytics_api_ga4::{AnalyticsDataApi, GoogleApiError, RunReportRequest};
use std::fmt;

const ANALYTICS_READONLY_SCOPE: &str = "https://www.googleapis.com/auth/analytics.readonly";

// GA4 has no built-in "all time" date range alias; this predates any
// property this site would plausibly query, so in practice it covers every
// day GA4 has recorded.
const EARLIEST_POSSIBLE_DATE: &str = "2015-08-14";

// How many of the most-visited pages to pull back when GA4_TOP_PAGES_LIMIT
// is unset or invalid.
const DEFAULT_TOP_PAGES_LIMIT: u32 = 50;

// Both the service-account key and the property to query it against are
// only required in production (see `ws_counter::is_production`); a missing
// or blank value here just means GA4 querying is disabled, mirroring how
// TLS_CERT_PATH/TLS_KEY_PATH are treated as "feature off" in src/tls.rs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Ga4Config {
    credentials_path: String,
    property_id: String,
    top_pages_limit: u32,
}

impl Ga4Config {
    // GOOGLE_APPLICATION_CREDENTIALS is the standard GCP client-library
    // convention for "path to a service-account JSON key", so it also works
    // unmodified with gcloud/other Google tooling if this ever moves onto a
    // GCE metadata-server identity instead of a checked-out key file.
    pub(crate) fn from_env() -> Option<Self> {
        Some(Self {
            credentials_path: non_empty_env("GOOGLE_APPLICATION_CREDENTIALS")?,
            property_id: non_empty_env("GA4_PROPERTY_ID")?,
            top_pages_limit: top_pages_limit_from_env(),
        })
    }
}

fn non_empty_env(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|s| !s.is_empty())
}

// Blank/missing/zero/unparseable all fall back to the default, same as
// TLS_PORT in src/tls.rs.
fn top_pages_limit_from_env() -> u32 {
    std::env::var("GA4_TOP_PAGES_LIMIT")
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|&limit| limit > 0)
        .unwrap_or(DEFAULT_TOP_PAGES_LIMIT)
}

#[derive(Debug)]
pub(crate) enum Ga4Error {
    Auth(gcp_auth::Error),
    Api(GoogleApiError),
}

impl fmt::Display for Ga4Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Ga4Error::Auth(e) => write!(f, "GA4 authentication failed: {e}"),
            Ga4Error::Api(e) => write!(f, "GA4 API request failed: {e}"),
        }
    }
}

// No path filter here: this pulls whichever pages GA4 considers
// most-visited (top `limit`, by totalUsers descending), not a fixed set
// this site happens to know about ahead of time.
fn report_request(property_id: &str, limit: u32) -> RunReportRequest {
    RunReportRequest {
        property: format!("properties/{property_id}"),
        dimensions: Dimension::from_string_vec(vec!["pagePath"]),
        metrics: Metric::from_string_vec(vec!["totalUsers"]),
        date_ranges: vec![DateRange::new("all_time", EARLIEST_POSSIBLE_DATE, "today")],
        order_bys: Some(vec![OrderBy::metric("totalUsers", true)]),
        limit: Some(limit.to_string()),
        ..RunReportRequest::default()
    }
}

// Maps GA4's row-based response into (path, total users) pairs, preserving
// the response's order (already sorted by totalUsers descending, per
// `report_request`'s order_bys). Rows with a missing/unparseable dimension
// or metric value are skipped rather than failing the whole report.
fn top_pages_from_response(response: &RunReportResponse) -> Vec<(String, u64)> {
    response
        .rows
        .iter()
        .flatten()
        .filter_map(|row| {
            let path = row
                .dimension_values
                .as_ref()
                .and_then(|values| values.first())
                .and_then(|value| value.value.clone())?;
            let total = row
                .metric_values
                .as_ref()
                .and_then(|values| values.first())
                .and_then(|value| value.value.as_ref())
                .and_then(|value| value.parse::<u64>().ok())?;
            Some((path, total))
        })
        .collect()
}

// The only function in this module that touches the network: loads the
// service-account key, exchanges it for a bearer token, then runs the
// report. Not covered by tests past the auth step (that would need live GA4
// credentials); the request/response shaping around it is (`report_request`,
// `top_pages_from_response`), and the auth failure path is exercised with a
// nonexistent credentials file.
pub(crate) async fn fetch_top_pages(config: &Ga4Config) -> Result<Vec<(String, u64)>, Ga4Error> {
    let service_account =
        CustomServiceAccount::from_file(&config.credentials_path).map_err(Ga4Error::Auth)?;
    let token = service_account
        .token(&[ANALYTICS_READONLY_SCOPE])
        .await
        .map_err(Ga4Error::Auth)?;

    let request = report_request(&config.property_id, config.top_pages_limit);
    let response = AnalyticsDataApi::run_report(token.as_str(), &config.property_id, request)
        .await
        .map_err(Ga4Error::Api)?;

    Ok(top_pages_from_response(&response))
}

#[cfg(test)]
mod tests {
    use super::*;
    use google_analytics_api_ga4::types::{DimensionValue, MetricValue, Row};
    use serial_test::serial;

    fn set_env(key: &str, value: &str) {
        unsafe { std::env::set_var(key, value) };
    }

    fn remove_env(key: &str) {
        unsafe { std::env::remove_var(key) };
    }

    fn clear_ga4_env() {
        remove_env("GOOGLE_APPLICATION_CREDENTIALS");
        remove_env("GA4_PROPERTY_ID");
        remove_env("GA4_TOP_PAGES_LIMIT");
    }

    #[test]
    #[serial(ga4_env)]
    fn from_env_is_none_when_both_unset() {
        clear_ga4_env();
        assert!(Ga4Config::from_env().is_none());
    }

    #[test]
    #[serial(ga4_env)]
    fn from_env_is_none_when_only_credentials_path_is_set() {
        clear_ga4_env();
        set_env("GOOGLE_APPLICATION_CREDENTIALS", "/tmp/creds.json");
        assert!(Ga4Config::from_env().is_none());
        clear_ga4_env();
    }

    #[test]
    #[serial(ga4_env)]
    fn from_env_is_none_when_only_property_id_is_set() {
        clear_ga4_env();
        set_env("GA4_PROPERTY_ID", "123456789");
        assert!(Ga4Config::from_env().is_none());
        clear_ga4_env();
    }

    #[test]
    #[serial(ga4_env)]
    fn from_env_is_none_when_values_are_blank() {
        clear_ga4_env();
        set_env("GOOGLE_APPLICATION_CREDENTIALS", "");
        set_env("GA4_PROPERTY_ID", "");
        assert!(Ga4Config::from_env().is_none());
        clear_ga4_env();
    }

    #[test]
    #[serial(ga4_env)]
    fn from_env_defaults_the_top_pages_limit_to_50() {
        clear_ga4_env();
        set_env("GOOGLE_APPLICATION_CREDENTIALS", "/tmp/creds.json");
        set_env("GA4_PROPERTY_ID", "123456789");
        assert_eq!(
            Ga4Config::from_env(),
            Some(Ga4Config {
                credentials_path: "/tmp/creds.json".to_string(),
                property_id: "123456789".to_string(),
                top_pages_limit: 50,
            })
        );
        clear_ga4_env();
    }

    #[test]
    #[serial(ga4_env)]
    fn from_env_reads_the_top_pages_limit_override() {
        clear_ga4_env();
        set_env("GOOGLE_APPLICATION_CREDENTIALS", "/tmp/creds.json");
        set_env("GA4_PROPERTY_ID", "123456789");
        set_env("GA4_TOP_PAGES_LIMIT", "10");
        assert_eq!(Ga4Config::from_env().map(|c| c.top_pages_limit), Some(10));
        clear_ga4_env();
    }

    #[test]
    #[serial(ga4_env)]
    fn from_env_falls_back_to_50_for_an_invalid_top_pages_limit() {
        clear_ga4_env();
        set_env("GOOGLE_APPLICATION_CREDENTIALS", "/tmp/creds.json");
        set_env("GA4_PROPERTY_ID", "123456789");
        set_env("GA4_TOP_PAGES_LIMIT", "not-a-number");
        assert_eq!(Ga4Config::from_env().map(|c| c.top_pages_limit), Some(50));
        clear_ga4_env();
    }

    #[test]
    #[serial(ga4_env)]
    fn from_env_falls_back_to_50_for_a_zero_top_pages_limit() {
        clear_ga4_env();
        set_env("GOOGLE_APPLICATION_CREDENTIALS", "/tmp/creds.json");
        set_env("GA4_PROPERTY_ID", "123456789");
        set_env("GA4_TOP_PAGES_LIMIT", "0");
        assert_eq!(Ga4Config::from_env().map(|c| c.top_pages_limit), Some(50));
        clear_ga4_env();
    }

    #[test]
    fn report_request_scopes_the_property_metrics_ordering_and_limit() {
        let request = report_request("123456789", 25);

        // None of the crate's request types implement PartialEq, so assert
        // on the exact wire shape instead (also doubles as a check that the
        // request serializes into what the GA4 Data API actually expects).
        assert_eq!(
            serde_json::to_string(&request).unwrap(),
            concat!(
                r#"{"property":"properties/123456789","dimensions":[{"name":"pagePath"}],"#,
                r#""metrics":[{"name":"totalUsers"}],"#,
                r#""dateRanges":[{"startDate":"2015-08-14","endDate":"today","name":"all_time"}],"#,
                r#""limit":"25","orderBys":[{"metric":{"metricName":"totalUsers"},"desc":true}]}"#,
            )
        );
    }

    fn row(path: &str, total_users: &str) -> Row {
        Row {
            dimension_values: Some(vec![DimensionValue {
                value: Some(path.to_string()),
            }]),
            metric_values: Some(vec![MetricValue {
                value: Some(total_users.to_string()),
            }]),
        }
    }

    #[test]
    fn top_pages_from_response_is_empty_when_there_are_no_rows() {
        let response = RunReportResponse::default();
        assert_eq!(top_pages_from_response(&response), Vec::new());
    }

    #[test]
    fn top_pages_from_response_preserves_response_order() {
        let response = RunReportResponse {
            rows: Some(vec![row("/", "42"), row("/about-me", "7")]),
            ..RunReportResponse::default()
        };

        assert_eq!(
            top_pages_from_response(&response),
            vec![("/".to_string(), 42), ("/about-me".to_string(), 7)]
        );
    }

    #[test]
    fn top_pages_from_response_skips_rows_missing_a_dimension_value() {
        let response = RunReportResponse {
            rows: Some(vec![
                Row {
                    dimension_values: None,
                    metric_values: Some(vec![MetricValue {
                        value: Some("5".to_string()),
                    }]),
                },
                row("/", "42"),
            ]),
            ..RunReportResponse::default()
        };

        assert_eq!(
            top_pages_from_response(&response),
            vec![("/".to_string(), 42)]
        );
    }

    #[test]
    fn top_pages_from_response_skips_rows_with_an_unparseable_metric_value() {
        let response = RunReportResponse {
            rows: Some(vec![row("/", "not-a-number"), row("/about-me", "7")]),
            ..RunReportResponse::default()
        };

        assert_eq!(
            top_pages_from_response(&response),
            vec![("/about-me".to_string(), 7)]
        );
    }

    #[actix_web::test]
    async fn fetch_top_pages_fails_when_the_credentials_file_does_not_exist() {
        let config = Ga4Config {
            credentials_path: "/nonexistent/ga4-credentials.json".to_string(),
            property_id: "123456789".to_string(),
            top_pages_limit: 50,
        };

        let result = fetch_top_pages(&config).await;
        assert!(matches!(result, Err(Ga4Error::Auth(_))));
    }

    #[test]
    fn ga4_error_display_includes_the_underlying_error() {
        let auth_err = Ga4Error::Auth(gcp_auth::Error::Str("boom"));
        assert!(auth_err.to_string().contains("boom"));

        let api_err = Ga4Error::Api(GoogleApiError::Connection("timed out".to_string()));
        assert!(api_err.to_string().contains("timed out"));
    }
}
