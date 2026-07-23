use crate::ga4::{self, Ga4Config};
use crate::store;
use actix_web::http::header;
use actix_web::{Error, HttpRequest, HttpResponse, Result, rt, web};
use actix_ws::AggregatedMessage;
use chrono::NaiveDate;
use futures_util::StreamExt as _;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::{Notify, watch};

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

// Used when VISITOR_TICK_INTERVAL_MINUTES is unset or invalid.
const DEFAULT_VISITOR_TICK_INTERVAL_MINUTES: u64 = 1;

// The counter payload is a few hundred bytes and clients never legitimately send
// text/binary data, so anything above this is either a bug or abuse.
const MAX_WS_MESSAGE_SIZE: usize = 1024;

// Upper bound on concurrent counter sessions so a burst of sockets can't exhaust
// memory/file descriptors on a small host. Each session is one spawned task plus
// a watch receiver, so the cap is about resource ceiling, not throughput.
const MAX_WS_SESSIONS: usize = 256;

// How far back to backfill ga4_daily_visitors the first time the daily sync
// runs against an empty table.
const BACKFILL_DAYS: i64 = 365;

// How often the daily GA4 sync task wakes up to check whether it's caught
// up. It fires immediately on startup and then on this cadence; exact wall
// clock timing isn't important since GA4's own data already lags by hours
// (see the design discussion this followed).
const DAILY_SYNC_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);

#[derive(Serialize)]
struct PathVisitorCount {
    path: String,
    total_unique_visitors: u64,
}

fn counters_json(counters: &[PathVisitorCount]) -> String {
    serde_json::to_string(counters).unwrap()
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

// The visitor ticker checks this before doing any work, so a quiet site
// with nobody watching the counter doesn't spend GA4 quota (or even the
// dev-mode local increment) on updates nobody will see.
fn has_active_sessions() -> bool {
    WS_SESSIONS.load(Ordering::Relaxed) > 0
}

// Browsers always send Origin on WebSocket upgrades, so this blocks other sites
// from opening sockets against us (cross-site WebSocket hijacking / resource
// abuse). Requests without an Origin (curl, monitoring) are allowed — the data
// is public and non-browser clients aren't confused deputies.
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

pub(crate) async fn handle(
    req: HttpRequest,
    body: web::Payload,
    tx: web::Data<watch::Sender<String>>,
    refresh: web::Data<Arc<Notify>>,
) -> Result<HttpResponse, Error> {
    if !same_origin(&req) {
        return Ok(HttpResponse::Forbidden().finish());
    }

    let Some(slot) = SessionSlot::try_acquire() else {
        return Ok(HttpResponse::ServiceUnavailable().finish());
    };

    // Wakes the ticker (see spawn_combined_ticker) so a fresh visitor sees
    // real counts promptly instead of whatever was last broadcast - which,
    // right after a cold start, can be nothing at all for up to a full
    // VISITOR_TICK_INTERVAL_MINUTES.
    refresh.notify_one();

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

// Querying GA4 costs quota and needs a service-account key, so the daily
// sync only ever runs in production (APP_ENV=production). Any other value
// - including unset, which covers local dev and the test suite - leaves
// the long-term tables empty; the combined ticker below still runs
// regardless, showing whatever the self-tracked short-term data has.
fn is_production() -> bool {
    std::env::var("APP_ENV").is_ok_and(|value| value == "production")
}

// How often the ticker wakes up to check for active sessions and, if any
// exist, recompute and broadcast the combined total. Blank/missing/zero/
// unparseable all fall back to the default, same convention as
// GA4_TOP_PAGES_LIMIT in src/ga4.rs.
fn visitor_tick_interval() -> Duration {
    let minutes = std::env::var("VISITOR_TICK_INTERVAL_MINUTES")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|&minutes| minutes > 0)
        .unwrap_or(DEFAULT_VISITOR_TICK_INTERVAL_MINUTES);
    Duration::from_secs(minutes * 60)
}

// Merges the two sources into one per-page total: GA4's own lifetime-
// distinct count (correctly deduplicated server-side) plus this site's own
// self-tracked count of visits since the long-term data was last synced
// (see src/store.rs). A page that only appears in one side (e.g. brand new,
// not yet in a GA4 sync) still shows up, starting from whichever side has
// it. Sorted by path for deterministic output. Pure, so it's unit-testable
// without a database.
fn combine_totals(
    all_time: HashMap<String, u64>,
    short_term: HashMap<String, u64>,
) -> Vec<PathVisitorCount> {
    let mut combined = all_time;
    for (path, count) in short_term {
        *combined.entry(path).or_insert(0) += count;
    }

    let mut counters: Vec<PathVisitorCount> = combined
        .into_iter()
        .map(|(path, total_unique_visitors)| PathVisitorCount {
            path,
            total_unique_visitors,
        })
        .collect();
    counters.sort_by(|a, b| a.path.cmp(&b.path));
    counters
}

// `refresh` lets callers (a new WS connection, a short-term-visit batch
// write, a completed daily sync) wake this up between scheduled ticks, so
// fresh data shows up promptly instead of waiting for the next fixed
// interval - which, right after a cold start with nobody connected yet,
// would otherwise waste the very first tick and leave the *next* visitor
// waiting up to a full tick_interval for anything to appear at all.
fn spawn_combined_ticker(
    tx: watch::Sender<String>,
    db_path: PathBuf,
    tick_interval: Duration,
    refresh: Arc<Notify>,
) {
    rt::spawn(async move {
        let mut interval = rt::time::interval(tick_interval);
        loop {
            tokio::select! {
                _ = interval.tick() => {}
                _ = refresh.notified() => {}
            }

            // Nobody's watching the counter right now, so skip the database
            // read and the broadcast entirely - the next wakeup checks again.
            if !has_active_sessions() {
                continue;
            }

            match read_combined_totals(db_path.clone()).await {
                Ok((all_time, short_term)) => {
                    let counters = combine_totals(all_time, short_term);
                    let _ = tx.send(counters_json(&counters));
                }
                Err(e) => log::error!("visitor ticker: failed to read combined totals: {e}"),
            }
        }
    });
}

// rusqlite is synchronous, so every database access here runs inside
// spawn_blocking rather than on the async executor thread.
async fn read_combined_totals(
    db_path: PathBuf,
) -> Result<(HashMap<String, u64>, HashMap<String, u64>), store::StoreError> {
    tokio::task::spawn_blocking(move || {
        let conn = store::open(&db_path)?;
        let all_time = store::all_time_totals(&conn)?;
        let watermark = store::max_daily_date(&conn)?;
        let short_term = store::short_term_totals_since(&conn, watermark)?;
        Ok((all_time, short_term))
    })
    .await
    .expect("read_combined_totals: blocking task panicked")
}

#[derive(Debug)]
enum DailySyncError {
    Store(store::StoreError),
    Ga4(ga4::Ga4Error),
}

impl std::fmt::Display for DailySyncError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DailySyncError::Store(e) => write!(f, "{e}"),
            DailySyncError::Ga4(e) => write!(f, "{e}"),
        }
    }
}

impl From<store::StoreError> for DailySyncError {
    fn from(e: store::StoreError) -> Self {
        DailySyncError::Store(e)
    }
}

// Given today's watermark (the latest date already in ga4_daily_visitors)
// and yesterday's date, decides what range to fetch next: a full backfill
// if there's no watermark yet, otherwise just the days since it. Returns
// None once already caught up (e.g. the daily sync already ran today).
// Pure so the backfill-vs-incremental decision is unit-testable without a
// database or network call.
fn next_sync_range(
    watermark: Option<NaiveDate>,
    yesterday: NaiveDate,
) -> Option<(NaiveDate, NaiveDate)> {
    let backfill_start = yesterday - chrono::Duration::days(BACKFILL_DAYS - 1);
    let start = watermark
        .map(|d| d + chrono::Duration::days(1))
        .unwrap_or(backfill_start);

    (start <= yesterday).then_some((start, yesterday))
}

fn spawn_ga4_daily_sync(db_path: PathBuf, config: Ga4Config, refresh: Arc<Notify>) {
    rt::spawn(async move {
        let mut interval = rt::time::interval(DAILY_SYNC_INTERVAL);
        loop {
            interval.tick().await;
            match run_daily_sync(&db_path, &config).await {
                Ok(()) => refresh.notify_one(),
                Err(e) => log::error!("visitor ticker: GA4 daily sync failed: {e}"),
            }
        }
    });
}

async fn run_daily_sync(db_path: &Path, config: &Ga4Config) -> Result<(), DailySyncError> {
    let yesterday = chrono::Utc::now().date_naive() - chrono::Duration::days(1);

    let watermark = {
        let db_path = db_path.to_path_buf();
        tokio::task::spawn_blocking(move || -> Result<Option<NaiveDate>, store::StoreError> {
            let conn = store::open(&db_path)?;
            Ok(store::max_daily_date(&conn)?)
        })
        .await
        .expect("run_daily_sync: blocking task panicked")?
    };

    let Some((start, end)) = next_sync_range(watermark, yesterday) else {
        return Ok(()); // Already caught up.
    };

    let daily_rows = ga4::fetch_daily_page_visitors(config, start, end)
        .await
        .map_err(DailySyncError::Ga4)?;
    let all_time_rows = ga4::fetch_all_time_visitor_totals(config)
        .await
        .map_err(DailySyncError::Ga4)?;

    let db_path = db_path.to_path_buf();
    tokio::task::spawn_blocking(move || -> Result<(), store::StoreError> {
        let mut conn = store::open(&db_path)?;
        store::upsert_daily_visitors(&mut conn, &daily_rows)?;
        store::replace_all_time_visitors(&mut conn, &all_time_rows, end)?;
        store::prune_short_term_visits_through(&conn, end)?;
        Ok(())
    })
    .await
    .expect("run_daily_sync: blocking task panicked")?;

    Ok(())
}

pub(crate) fn start(db_path: PathBuf, refresh: Arc<Notify>) -> watch::Sender<String> {
    let (tx, _rx) = watch::channel(counters_json(&[]));

    if is_production() {
        match Ga4Config::from_env() {
            Some(config) => {
                log::info!("visitor ticker: GA4 daily sync enabled");
                spawn_ga4_daily_sync(db_path.clone(), config, refresh.clone());
            }
            None => log::warn!(
                "visitor ticker: APP_ENV=production but GOOGLE_APPLICATION_CREDENTIALS/GA4_PROPERTY_ID \
                 are not both set; the long-term visitor totals will not update"
            ),
        }
    } else {
        log::info!("visitor ticker: GA4 daily sync disabled (APP_ENV is not \"production\")");
    }

    spawn_combined_ticker(tx.clone(), db_path, visitor_tick_interval(), refresh);
    tx
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test::TestRequest;
    use serial_test::serial;

    #[test]
    fn counters_json_serializes_the_expected_shape() {
        let counters = vec![
            PathVisitorCount {
                path: "/".to_string(),
                total_unique_visitors: 3,
            },
            PathVisitorCount {
                path: "/about-me".to_string(),
                total_unique_visitors: 0,
            },
        ];

        assert_eq!(
            counters_json(&counters),
            r#"[{"path":"/","total_unique_visitors":3},{"path":"/about-me","total_unique_visitors":0}]"#
        );
    }

    // std::env::set_var/remove_var are unsafe as of the 2024 edition, and
    // APP_ENV is process-wide state shared by every test here - hence the
    // small unsafe wrappers plus #[serial] on every test that touches it.
    fn set_env(key: &str, value: &str) {
        unsafe { std::env::set_var(key, value) };
    }

    fn remove_env(key: &str) {
        unsafe { std::env::remove_var(key) };
    }

    #[test]
    #[serial(app_env)]
    fn is_production_is_false_when_app_env_is_unset() {
        remove_env("APP_ENV");
        assert!(!is_production());
    }

    #[test]
    #[serial(app_env)]
    fn is_production_is_true_when_app_env_is_production() {
        set_env("APP_ENV", "production");
        assert!(is_production());
        remove_env("APP_ENV");
    }

    #[test]
    #[serial(app_env)]
    fn is_production_is_false_for_any_other_app_env_value() {
        set_env("APP_ENV", "development");
        assert!(!is_production());
        remove_env("APP_ENV");
    }

    #[test]
    #[serial(tick_interval_env)]
    fn visitor_tick_interval_defaults_to_one_minute() {
        remove_env("VISITOR_TICK_INTERVAL_MINUTES");
        assert_eq!(visitor_tick_interval(), Duration::from_secs(60));
    }

    #[test]
    #[serial(tick_interval_env)]
    fn visitor_tick_interval_reads_the_env_override() {
        set_env("VISITOR_TICK_INTERVAL_MINUTES", "5");
        assert_eq!(visitor_tick_interval(), Duration::from_secs(300));
        remove_env("VISITOR_TICK_INTERVAL_MINUTES");
    }

    #[test]
    #[serial(tick_interval_env)]
    fn visitor_tick_interval_falls_back_to_one_minute_for_an_invalid_value() {
        set_env("VISITOR_TICK_INTERVAL_MINUTES", "not-a-number");
        assert_eq!(visitor_tick_interval(), Duration::from_secs(60));
        remove_env("VISITOR_TICK_INTERVAL_MINUTES");
    }

    #[test]
    #[serial(tick_interval_env)]
    fn visitor_tick_interval_falls_back_to_one_minute_for_zero() {
        set_env("VISITOR_TICK_INTERVAL_MINUTES", "0");
        assert_eq!(visitor_tick_interval(), Duration::from_secs(60));
        remove_env("VISITOR_TICK_INTERVAL_MINUTES");
    }

    fn date(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn combine_totals_adds_short_term_on_top_of_all_time() {
        let all_time = HashMap::from([("/".to_string(), 40)]);
        let short_term = HashMap::from([("/".to_string(), 2)]);

        let counters = combine_totals(all_time, short_term);

        assert_eq!(counters.len(), 1);
        assert_eq!(counters[0].path, "/");
        assert_eq!(counters[0].total_unique_visitors, 42);
    }

    #[test]
    fn combine_totals_includes_a_page_present_in_only_one_side() {
        let all_time = HashMap::from([("/".to_string(), 40)]);
        let short_term = HashMap::from([("/new-post".to_string(), 3)]);

        let counters = combine_totals(all_time, short_term);

        assert_eq!(counters.len(), 2);
        assert!(
            counters
                .iter()
                .any(|c| c.path == "/" && c.total_unique_visitors == 40)
        );
        assert!(
            counters
                .iter()
                .any(|c| c.path == "/new-post" && c.total_unique_visitors == 3)
        );
    }

    #[test]
    fn combine_totals_is_empty_when_both_sides_are_empty() {
        assert!(combine_totals(HashMap::new(), HashMap::new()).is_empty());
    }

    #[test]
    fn combine_totals_sorts_by_path() {
        let all_time = HashMap::from([("/z".to_string(), 1), ("/a".to_string(), 1)]);

        let counters = combine_totals(all_time, HashMap::new());

        assert_eq!(counters[0].path, "/a");
        assert_eq!(counters[1].path, "/z");
    }

    #[test]
    fn next_sync_range_backfills_a_year_when_there_is_no_watermark() {
        let yesterday = date("2026-06-01");
        let (start, end) = next_sync_range(None, yesterday).unwrap();

        assert_eq!(end, yesterday);
        assert_eq!(start, date("2025-06-02"));
        assert_eq!((end - start).num_days(), BACKFILL_DAYS - 1);
    }

    #[test]
    fn next_sync_range_fetches_only_since_the_watermark() {
        let watermark = date("2026-05-30");
        let yesterday = date("2026-06-01");

        assert_eq!(
            next_sync_range(Some(watermark), yesterday),
            Some((date("2026-05-31"), yesterday))
        );
    }

    #[test]
    fn next_sync_range_is_none_when_already_caught_up() {
        let yesterday = date("2026-06-01");
        // Watermark already equals yesterday: nothing new to fetch.
        assert_eq!(next_sync_range(Some(yesterday), yesterday), None);
    }

    #[test]
    fn next_sync_range_is_none_when_the_watermark_is_in_the_future() {
        let yesterday = date("2026-06-01");
        assert_eq!(next_sync_range(Some(date("2026-06-05")), yesterday), None);
    }

    #[test]
    fn daily_sync_error_display_includes_the_underlying_error() {
        let store_err = DailySyncError::Store(store::StoreError::Sqlite(
            rusqlite::Error::QueryReturnedNoRows,
        ));
        assert!(store_err.to_string().contains("Query returned no rows"));

        let ga4_err = DailySyncError::Ga4(ga4::Ga4Error::Auth(gcp_auth::Error::Str("boom")));
        assert!(ga4_err.to_string().contains("boom"));
    }

    #[tokio::test]
    async fn read_combined_totals_reads_all_time_and_short_term_from_the_database() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("visitors.db");
        {
            let mut conn = store::open(&db_path).unwrap();
            store::replace_all_time_visitors(
                &mut conn,
                &[("/".to_string(), 10)],
                date("2026-01-01"),
            )
            .unwrap();
            store::insert_short_term_visits(
                &mut conn,
                &[store::ShortTermVisit {
                    day: date("2026-01-02"),
                    path: "/".to_string(),
                    visitor_key: "alice".to_string(),
                }],
            )
            .unwrap();
        }

        let (all_time, short_term) = read_combined_totals(db_path).await.unwrap();
        assert_eq!(all_time.get("/"), Some(&10));
        assert_eq!(short_term.get("/"), Some(&1));
    }

    // Exercises the early-return branch (already caught up, so no GA4 call
    // is ever made) without needing real credentials - `Ga4Config::from_env`
    // just needs *some* values present, since run_daily_sync returns before
    // they're used for anything.
    #[actix_web::test]
    #[serial(ga4_env)]
    async fn run_daily_sync_does_nothing_when_already_caught_up() {
        set_env("GOOGLE_APPLICATION_CREDENTIALS", "/nonexistent/creds.json");
        set_env("GA4_PROPERTY_ID", "123456789");
        let config = Ga4Config::from_env().unwrap();
        remove_env("GOOGLE_APPLICATION_CREDENTIALS");
        remove_env("GA4_PROPERTY_ID");

        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("visitors.db");
        let yesterday = chrono::Utc::now().date_naive() - chrono::Duration::days(1);
        {
            let mut conn = store::open(&db_path).unwrap();
            store::upsert_daily_visitors(&mut conn, &[(yesterday, "/".to_string(), 1)]).unwrap();
        }

        assert!(run_daily_sync(&db_path, &config).await.is_ok());
    }

    #[actix_web::test]
    #[serial(ws_sessions)]
    async fn spawn_combined_ticker_broadcasts_the_combined_total_when_a_session_is_active() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("visitors.db");
        {
            let mut conn = store::open(&db_path).unwrap();
            store::replace_all_time_visitors(
                &mut conn,
                &[("/".to_string(), 5)],
                date("2026-01-01"),
            )
            .unwrap();
        }

        // Keeps has_active_sessions() true for the duration of the test.
        let _slot = SessionSlot::try_acquire().expect("should have room");

        let (tx, rx) = watch::channel(counters_json(&[]));
        spawn_combined_ticker(
            tx,
            db_path,
            Duration::from_millis(20),
            Arc::new(Notify::new()),
        );

        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        loop {
            if rx.borrow().contains(r#""total_unique_visitors":5"#) {
                break;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "ticker did not broadcast the combined total in time"
            );
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
    }

    // Regression test for the actual reported bug: a fixed-interval-only
    // ticker wastes its first (immediate) tick at startup, before anyone's
    // connected - so the *next* visitor would otherwise wait up to a full
    // tick_interval (here, deliberately 1 hour, far past the test timeout)
    // for anything to appear. Spawns with no session active (so that first
    // tick genuinely no-ops, confirmed below) and only later acquires a
    // session and notifies - the update can then only be explained by
    // refresh.notify_one() waking the ticker early, not by the schedule.
    #[actix_web::test]
    #[serial(ws_sessions)]
    async fn spawn_combined_ticker_refreshes_immediately_on_notify() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("visitors.db");
        {
            let mut conn = store::open(&db_path).unwrap();
            store::replace_all_time_visitors(
                &mut conn,
                &[("/".to_string(), 7)],
                date("2026-01-01"),
            )
            .unwrap();
        }

        let (tx, rx) = watch::channel(counters_json(&[]));
        let refresh = Arc::new(Notify::new());
        spawn_combined_ticker(tx, db_path, Duration::from_secs(3600), refresh.clone());

        // Give the ticker's own immediate first tick a chance to run and
        // confirm it did nothing (no session yet), isolating the update
        // below from that startup tick rather than relying on the 1-hour
        // interval alone to rule it out.
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        assert_eq!(
            rx.borrow().clone(),
            "[]",
            "no session was active yet, so the startup tick should not have broadcast anything"
        );

        let _slot = SessionSlot::try_acquire().expect("should have room");
        refresh.notify_one();

        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        loop {
            if rx.borrow().contains(r#""total_unique_visitors":7"#) {
                break;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "ticker did not refresh promptly after being notified"
            );
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
    }

    #[test]
    fn same_origin_allows_requests_with_no_origin_header() {
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .to_http_request();
        assert!(same_origin(&req));
    }

    #[test]
    fn same_origin_allows_a_matching_https_origin() {
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .insert_header((header::ORIGIN, "https://example.com"))
            .to_http_request();
        assert!(same_origin(&req));
    }

    #[test]
    fn same_origin_allows_a_matching_http_origin_case_insensitively() {
        let req = TestRequest::default()
            .insert_header((header::HOST, "Example.com"))
            .insert_header((header::ORIGIN, "http://example.com"))
            .to_http_request();
        assert!(same_origin(&req));
    }

    #[test]
    fn same_origin_rejects_a_mismatched_origin() {
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .insert_header((header::ORIGIN, "https://evil.example"))
            .to_http_request();
        assert!(!same_origin(&req));
    }

    #[test]
    fn same_origin_rejects_an_origin_without_a_recognized_scheme() {
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .insert_header((header::ORIGIN, "ftp://example.com"))
            .to_http_request();
        assert!(!same_origin(&req));
    }

    #[test]
    fn same_origin_rejects_when_host_is_missing() {
        let req = TestRequest::default()
            .insert_header((header::ORIGIN, "https://example.com"))
            .to_http_request();
        assert!(!same_origin(&req));
    }

    #[test]
    fn same_origin_rejects_a_non_utf8_origin_header() {
        let bad_value = actix_web::http::header::HeaderValue::from_bytes(&[0xff, 0xfe]).unwrap();
        let req = TestRequest::default()
            .insert_header((header::HOST, "example.com"))
            .insert_header((header::ORIGIN, bad_value))
            .to_http_request();
        assert!(!same_origin(&req));
    }

    #[test]
    #[serial(ws_sessions)]
    fn session_slot_enforces_the_concurrency_cap_and_releases_on_drop() {
        // Baseline first: WS_SESSIONS is process-wide, so start from whatever
        // it currently is rather than assuming a pristine 0.
        let baseline = WS_SESSIONS.load(Ordering::Relaxed);
        let room_left = MAX_WS_SESSIONS - baseline;

        let slots: Vec<SessionSlot> = (0..room_left)
            .map(|_| SessionSlot::try_acquire().expect("should have room"))
            .collect();
        assert_eq!(WS_SESSIONS.load(Ordering::Relaxed), MAX_WS_SESSIONS);

        assert!(SessionSlot::try_acquire().is_none());

        drop(slots);
        assert_eq!(WS_SESSIONS.load(Ordering::Relaxed), baseline);

        // The budget is usable again once slots are freed.
        let reacquired = SessionSlot::try_acquire().expect("should have room again");
        drop(reacquired);
    }

    #[test]
    #[serial(ws_sessions)]
    fn has_active_sessions_reflects_whether_any_slot_is_held() {
        // Baseline-relative, like the test above, since WS_SESSIONS is
        // process-wide.
        let baseline = WS_SESSIONS.load(Ordering::Relaxed);
        assert_eq!(has_active_sessions(), baseline > 0);

        let slot = SessionSlot::try_acquire().expect("should have room");
        assert!(has_active_sessions());

        drop(slot);
        assert_eq!(has_active_sessions(), baseline > 0);
    }

    #[actix_web::test]
    async fn start_seeds_the_watch_channel_with_an_empty_list() {
        // The real per-page counts only exist once the ticker has read them
        // from sqlite; start() itself just seeds an empty snapshot and
        // spawns the background tasks that will fill it in.
        let dir = tempfile::tempdir().unwrap();
        let tx = start(dir.path().join("visitors.db"), Arc::new(Notify::new()));
        let rx = tx.subscribe();

        assert_eq!(rx.borrow().clone(), "[]");
    }

    // Real websocket-protocol integration tests for `handle`, using a bound
    // test server plus a real client (rather than `start()`, so each test
    // controls its own watch channel directly instead of waiting on the real
    // 60s visitor ticker).
    mod handle_ws {
        use super::*;
        use actix_web::web::Bytes;
        use actix_web::{App, web};
        use awc::ws::{Frame, Message};
        use futures_util::{SinkExt, StreamExt};

        fn test_refresh_data() -> web::Data<Arc<Notify>> {
            web::Data::new(Arc::new(Notify::new()))
        }

        fn test_app_with_channel() -> (actix_test::TestServer, watch::Sender<String>) {
            let (tx, _rx) = watch::channel(counters_json(&[]));
            let data = web::Data::new(tx.clone());
            let refresh = test_refresh_data();
            let srv = actix_test::start(move || {
                App::new()
                    .app_data(data.clone())
                    .app_data(refresh.clone())
                    .route("/ws-counter", web::get().to(handle))
            });
            (srv, tx)
        }

        #[actix_web::test]
        async fn sends_the_current_snapshot_immediately_on_connect() {
            let counters = vec![PathVisitorCount {
                path: "/".to_string(),
                total_unique_visitors: 5,
            }];
            let (tx, _rx) = watch::channel(counters_json(&counters));
            let data = web::Data::new(tx);
            let refresh = test_refresh_data();
            let mut srv = actix_test::start(move || {
                App::new()
                    .app_data(data.clone())
                    .app_data(refresh.clone())
                    .route("/ws-counter", web::get().to(handle))
            });

            let mut framed = srv.ws_at("/ws-counter").await.unwrap();
            let frame = framed.next().await.unwrap().unwrap();

            match frame {
                Frame::Text(bytes) => {
                    assert_eq!(
                        bytes,
                        Bytes::from_static(br#"[{"path":"/","total_unique_visitors":5}]"#)
                    );
                }
                other => panic!("expected an initial text snapshot, got {other:?}"),
            }
        }

        #[actix_web::test]
        async fn pushes_updates_published_on_the_watch_channel() {
            let (mut srv, tx) = test_app_with_channel();
            let mut framed = srv.ws_at("/ws-counter").await.unwrap();
            let _initial = framed.next().await.unwrap().unwrap();

            let updated = counters_json(&[PathVisitorCount {
                path: "/".to_string(),
                total_unique_visitors: 9,
            }]);
            tx.send(updated.clone()).unwrap();

            let frame = framed.next().await.unwrap().unwrap();
            match frame {
                Frame::Text(bytes) => assert_eq!(bytes, Bytes::from(updated)),
                other => panic!("expected the updated snapshot, got {other:?}"),
            }
        }

        #[actix_web::test]
        async fn responds_to_a_client_ping_with_a_pong() {
            let (mut srv, _tx) = test_app_with_channel();
            let mut framed = srv.ws_at("/ws-counter").await.unwrap();
            let _initial = framed.next().await.unwrap().unwrap();

            framed
                .send(Message::Ping(Bytes::from_static(b"hi")))
                .await
                .unwrap();

            let frame = framed.next().await.unwrap().unwrap();
            assert!(matches!(frame, Frame::Pong(bytes) if bytes == Bytes::from_static(b"hi")));
        }

        #[actix_web::test]
        async fn closes_the_session_when_the_client_sends_close() {
            let (mut srv, _tx) = test_app_with_channel();
            let mut framed = srv.ws_at("/ws-counter").await.unwrap();
            let _initial = framed.next().await.unwrap().unwrap();

            framed.send(Message::Close(None)).await.unwrap();

            match framed.next().await {
                Some(Ok(Frame::Close(_))) => {}
                None => {}
                other => panic!("expected a close frame or end of stream, got {other:?}"),
            }
        }

        #[actix_web::test]
        async fn rejects_a_cross_origin_websocket_upgrade() {
            let (srv, _tx) = test_app_with_channel();

            let client = awc::Client::new();
            let result = client
                .ws(srv.url("/ws-counter"))
                .header("Origin", "https://evil.example")
                .connect()
                .await;

            assert!(result.is_err());
        }
    }
}
