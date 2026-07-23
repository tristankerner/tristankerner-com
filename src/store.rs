use chrono::NaiveDate;
use rusqlite::{Connection, OptionalExtension, params};
use std::collections::HashMap;
use std::fmt;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::sync::mpsc;

const BUSY_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug)]
pub(crate) enum StoreError {
    Io(std::io::Error),
    Sqlite(rusqlite::Error),
}

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StoreError::Io(e) => write!(f, "I/O error: {e}"),
            StoreError::Sqlite(e) => write!(f, "sqlite error: {e}"),
        }
    }
}

impl From<std::io::Error> for StoreError {
    fn from(e: std::io::Error) -> Self {
        StoreError::Io(e)
    }
}

impl From<rusqlite::Error> for StoreError {
    fn from(e: rusqlite::Error) -> Self {
        StoreError::Sqlite(e)
    }
}

// Opens (creating if necessary) the sqlite file at `path`, including any
// missing parent directories - matters for a freshly mounted, empty volume
// in Docker. Every call re-applies pragmas and re-runs the (idempotent)
// schema DDL, so this is safe to use both for the one long-lived writer
// connection and for the short-lived, ad-hoc read connections opened by the
// ticker/daily-sync tasks; WAL lets those coexist without blocking each
// other.
pub(crate) fn open(path: &Path) -> Result<Connection, StoreError> {
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    apply_pragmas(&conn)?;
    init_schema(&conn)?;
    Ok(conn)
}

fn apply_pragmas(conn: &Connection) -> rusqlite::Result<()> {
    // WAL: readers (the ticker, the daily sync) don't block the writer (the
    // page-serve tracker) and vice versa - they're not contending for the
    // same lock the way the default rollback journal would have them.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    // FULL fsyncs on every commit; NORMAL is the standard high-throughput
    // pairing with WAL - it only risks losing the last few not-yet-synced
    // commits on an OS crash/power loss (not an ordinary app crash), an
    // acceptable tradeoff for a visitor counter.
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "temp_store", "MEMORY")?;
    // Retry briefly on a transient lock conflict instead of erroring
    // immediately - short-lived reader connections opened while the writer
    // holds the lock for a batch commit should just wait it out.
    conn.busy_timeout(BUSY_TIMEOUT)?;
    Ok(())
}

fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        -- Incrementally fetched, one row per (day, page) - see
        -- ga4::fetch_daily_page_visitors. The PRIMARY KEY's leading `date`
        -- column already indexes the `date > ?`/`MAX(date)` access patterns
        -- this table is queried with, so no separate index is needed.
        CREATE TABLE IF NOT EXISTS ga4_daily_visitors (
            date TEXT NOT NULL,
            path TEXT NOT NULL,
            total_users INTEGER NOT NULL,
            PRIMARY KEY (date, path)
        );

        -- The single source of truth for the lifetime-distinct total per
        -- page (GA4's own dedup over one all-time date range - see
        -- ga4::fetch_all_time_visitor_totals). Fully replaced on every daily
        -- sync rather than merged, so it never accumulates stale pages that
        -- fell out of the current top-N.
        CREATE TABLE IF NOT EXISTS ga4_all_time_visitors (
            path TEXT PRIMARY KEY,
            total_users INTEGER NOT NULL,
            as_of_date TEXT NOT NULL
        );

        -- Self-tracked page-serve hits, deduped by (day, path, visitor_key)
        -- via the PRIMARY KEY itself - correctness doesn't depend on
        -- application-level counting logic. Pruned once a day's worth of
        -- data has been absorbed into the two tables above (see
        -- prune_short_term_visits_through), so this stays roughly one day's
        -- traffic large rather than growing forever. The PK's leading `day`
        -- column indexes the `day > ?` watermark scan this is read with.
        CREATE TABLE IF NOT EXISTS short_term_visits (
            day TEXT NOT NULL,
            path TEXT NOT NULL,
            visitor_key TEXT NOT NULL,
            PRIMARY KEY (day, path, visitor_key)
        );

        -- Small generic settings store; today only holds the HMAC secret
        -- used to derive visitor keys (see load_or_create_hash_secret).
        CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value BLOB NOT NULL
        );
        ",
    )
}

fn parse_date(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").expect("date columns always store ISO 8601 dates")
}

// --- ga4_daily_visitors ----------------------------------------------------

pub(crate) fn max_daily_date(conn: &Connection) -> rusqlite::Result<Option<NaiveDate>> {
    let raw: Option<String> =
        conn.query_row("SELECT MAX(date) FROM ga4_daily_visitors", [], |row| {
            row.get(0)
        })?;
    Ok(raw.map(|s| parse_date(&s)))
}

// Upserts one row per (date, path); `total_users` is overwritten on a
// conflict rather than accumulated, since each call supplies GA4's own
// (already-correct) total for that day, not an increment.
pub(crate) fn upsert_daily_visitors(
    conn: &mut Connection,
    rows: &[(NaiveDate, String, u64)],
) -> rusqlite::Result<()> {
    if rows.is_empty() {
        return Ok(());
    }
    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO ga4_daily_visitors (date, path, total_users) VALUES (?1, ?2, ?3)
             ON CONFLICT (date, path) DO UPDATE SET total_users = excluded.total_users",
        )?;
        for (date, path, total_users) in rows {
            stmt.execute(params![date.to_string(), path, *total_users as i64])?;
        }
    }
    tx.commit()
}

// --- ga4_all_time_visitors --------------------------------------------------

// Wholesale replace: the caller always supplies the *complete* current
// top-N set from a single all-time-range query, so anything not in `rows`
// no longer belongs in the table (e.g. a page that dropped out of the top
// N since the last sync).
pub(crate) fn replace_all_time_visitors(
    conn: &mut Connection,
    rows: &[(String, u64)],
    as_of: NaiveDate,
) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    {
        tx.execute("DELETE FROM ga4_all_time_visitors", [])?;
        let mut stmt = tx.prepare(
            "INSERT INTO ga4_all_time_visitors (path, total_users, as_of_date) VALUES (?1, ?2, ?3)",
        )?;
        for (path, total_users) in rows {
            stmt.execute(params![path, *total_users as i64, as_of.to_string()])?;
        }
    }
    tx.commit()
}

pub(crate) fn all_time_totals(conn: &Connection) -> rusqlite::Result<HashMap<String, u64>> {
    let mut stmt = conn.prepare("SELECT path, total_users FROM ga4_all_time_visitors")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as u64))
    })?;
    rows.collect()
}

// --- short_term_visits -------------------------------------------------

#[derive(Debug, Clone)]
pub(crate) struct ShortTermVisit {
    pub(crate) day: NaiveDate,
    pub(crate) path: String,
    pub(crate) visitor_key: String,
}

pub(crate) fn insert_short_term_visits(
    conn: &mut Connection,
    events: &[ShortTermVisit],
) -> rusqlite::Result<()> {
    if events.is_empty() {
        return Ok(());
    }
    let tx = conn.transaction()?;
    {
        // OR IGNORE: a repeat visitor on the same day/page is expected and
        // is exactly what the UNIQUE (day, path, visitor_key) key is for -
        // it's not an error, just a no-op.
        let mut stmt = tx.prepare(
            "INSERT OR IGNORE INTO short_term_visits (day, path, visitor_key) VALUES (?1, ?2, ?3)",
        )?;
        for event in events {
            stmt.execute(params![
                event.day.to_string(),
                event.path,
                event.visitor_key
            ])?;
        }
    }
    tx.commit()
}

// `since = None` means "no long-term watermark yet" (e.g. before the first
// daily sync has ever run) - counts every row. Relies on `""` sorting
// before any real `YYYY-MM-DD` string, so a single query covers both cases
// without branching SQL.
pub(crate) fn short_term_totals_since(
    conn: &Connection,
    since: Option<NaiveDate>,
) -> rusqlite::Result<HashMap<String, u64>> {
    let since = since.map(|d| d.to_string()).unwrap_or_default();
    let mut stmt =
        conn.prepare("SELECT path, COUNT(*) FROM short_term_visits WHERE day > ?1 GROUP BY path")?;
    let rows = stmt.query_map(params![since], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as u64))
    })?;
    rows.collect()
}

// Called after a successful daily sync to drop rows the long-term tables
// now cover, keeping this table roughly one day's traffic large instead of
// growing forever.
pub(crate) fn prune_short_term_visits_through(
    conn: &Connection,
    through: NaiveDate,
) -> rusqlite::Result<usize> {
    conn.execute(
        "DELETE FROM short_term_visits WHERE day <= ?1",
        params![through.to_string()],
    )
}

// --- app_config / HMAC secret -----------------------------------------

const HASH_SECRET_KEY: &str = "visitor_hash_secret";
const HASH_SECRET_LEN: usize = 32;

// Returns the persisted per-deployment secret used to derive visitor keys
// (see src/visitor_key.rs), generating and persisting a fresh random one on
// first use. Persisting it (rather than regenerating per process start)
// keeps a visitor's key stable across restarts within the same day, so a
// redeploy mid-day doesn't let already-counted visitors be double-counted.
pub(crate) fn load_or_create_hash_secret(conn: &Connection) -> rusqlite::Result<Vec<u8>> {
    let existing: Option<Vec<u8>> = conn
        .query_row(
            "SELECT value FROM app_config WHERE key = ?1",
            params![HASH_SECRET_KEY],
            |row| row.get(0),
        )
        .optional()?;
    if let Some(secret) = existing {
        return Ok(secret);
    }

    let secret = generate_secret();
    conn.execute(
        "INSERT INTO app_config (key, value) VALUES (?1, ?2)",
        params![HASH_SECRET_KEY, secret],
    )?;
    Ok(secret)
}

fn generate_secret() -> Vec<u8> {
    let mut secret = vec![0u8; HASH_SECRET_LEN];
    getrandom::getrandom(&mut secret).expect("the system RNG is available");
    secret
}

// Handed to request handlers (see static_files::serve) as `web::Data` so
// they can record a page-serve hit without touching the database directly.
#[derive(Clone)]
pub(crate) struct VisitorTracker {
    pub(crate) sender: mpsc::Sender<ShortTermVisit>,
    pub(crate) hash_secret: std::sync::Arc<Vec<u8>>,
}

// --- background batching writer -----------------------------------------

// Bounded so a sustained flood can't grow memory without limit; under
// backpressure `try_send` (see the page-serve hook) just drops the event
// rather than blocking the request or erroring it.
const WRITE_QUEUE_CAPACITY: usize = 4096;
// Caps how many events land in a single transaction so one enormous burst
// doesn't hold the write lock for an outsized stretch.
const MAX_BATCH_SIZE: usize = 500;

// Spawns the single dedicated writer for `short_term_visits` and returns a
// sender for callers (the page-serve hook) to push events into. Runs on a
// blocking-pool thread since rusqlite is synchronous; `try_send` from an
// async context is still non-blocking, satisfying the "never slow down a
// page response" requirement.
pub(crate) fn spawn_writer(db_path: PathBuf) -> mpsc::Sender<ShortTermVisit> {
    let (tx, rx) = mpsc::channel(WRITE_QUEUE_CAPACITY);
    tokio::task::spawn_blocking(move || writer_loop(&db_path, rx));
    tx
}

fn writer_loop(db_path: &Path, mut rx: mpsc::Receiver<ShortTermVisit>) {
    let mut conn = match open(db_path) {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("visitor tracker: failed to open the writer connection: {e}");
            return;
        }
    };

    let mut batch = Vec::with_capacity(MAX_BATCH_SIZE);
    // Block until at least one event arrives (or the channel closes), then
    // greedily drain whatever else is already queued without waiting
    // further - this is what turns a burst of individual `try_send`s into
    // a single batched transaction.
    while let Some(first) = rx.blocking_recv() {
        batch.push(first);
        while batch.len() < MAX_BATCH_SIZE {
            match rx.try_recv() {
                Ok(event) => batch.push(event),
                Err(_) => break,
            }
        }

        if let Err(e) = insert_short_term_visits(&mut conn, &batch) {
            eprintln!(
                "visitor tracker: failed to write a batch of {} visit(s): {e}",
                batch.len()
            );
        }
        batch.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_db() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("visitors.db");
        (dir, path)
    }

    fn date(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn open_creates_missing_parent_directories() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("deeper").join("visitors.db");

        let conn = open(&path).unwrap();
        assert!(path.exists());
        // Schema init succeeded too, not just directory creation.
        assert_eq!(max_daily_date(&conn).unwrap(), None);
    }

    #[test]
    fn open_is_idempotent_across_repeated_opens() {
        let (_dir, path) = temp_db();
        open(&path).unwrap();
        // Re-opening (schema DDL + pragmas re-applied) must not error.
        open(&path).unwrap();
    }

    #[test]
    fn max_daily_date_is_none_when_the_table_is_empty() {
        let (_dir, path) = temp_db();
        let conn = open(&path).unwrap();
        assert_eq!(max_daily_date(&conn).unwrap(), None);
    }

    #[test]
    fn upsert_daily_visitors_inserts_new_rows() {
        let (_dir, path) = temp_db();
        let mut conn = open(&path).unwrap();

        upsert_daily_visitors(
            &mut conn,
            &[
                (date("2026-01-01"), "/".to_string(), 3),
                (date("2026-01-02"), "/".to_string(), 5),
            ],
        )
        .unwrap();

        assert_eq!(max_daily_date(&conn).unwrap(), Some(date("2026-01-02")));
    }

    #[test]
    fn upsert_daily_visitors_overwrites_on_conflict_instead_of_duplicating() {
        let (_dir, path) = temp_db();
        let mut conn = open(&path).unwrap();

        upsert_daily_visitors(&mut conn, &[(date("2026-01-01"), "/".to_string(), 3)]).unwrap();
        upsert_daily_visitors(&mut conn, &[(date("2026-01-01"), "/".to_string(), 9)]).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ga4_daily_visitors", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
        let total: i64 = conn
            .query_row("SELECT total_users FROM ga4_daily_visitors", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(total, 9);
    }

    #[test]
    fn upsert_daily_visitors_is_a_noop_for_an_empty_slice() {
        let (_dir, path) = temp_db();
        let mut conn = open(&path).unwrap();
        upsert_daily_visitors(&mut conn, &[]).unwrap();
        assert_eq!(max_daily_date(&conn).unwrap(), None);
    }

    #[test]
    fn replace_all_time_visitors_replaces_the_whole_table() {
        let (_dir, path) = temp_db();
        let mut conn = open(&path).unwrap();

        replace_all_time_visitors(
            &mut conn,
            &[("/".to_string(), 10), ("/old-page".to_string(), 4)],
            date("2026-01-01"),
        )
        .unwrap();
        replace_all_time_visitors(
            &mut conn,
            &[("/".to_string(), 12), ("/new-page".to_string(), 2)],
            date("2026-01-02"),
        )
        .unwrap();

        let totals = all_time_totals(&conn).unwrap();
        assert_eq!(totals.len(), 2);
        assert_eq!(totals.get("/"), Some(&12));
        assert_eq!(totals.get("/new-page"), Some(&2));
        assert!(!totals.contains_key("/old-page"));
    }

    #[test]
    fn all_time_totals_is_empty_when_the_table_is_empty() {
        let (_dir, path) = temp_db();
        let conn = open(&path).unwrap();
        assert!(all_time_totals(&conn).unwrap().is_empty());
    }

    fn visit(day: &str, path: &str, visitor_key: &str) -> ShortTermVisit {
        ShortTermVisit {
            day: date(day),
            path: path.to_string(),
            visitor_key: visitor_key.to_string(),
        }
    }

    #[test]
    fn insert_short_term_visits_dedupes_via_the_unique_key() {
        let (_dir, path) = temp_db();
        let mut conn = open(&path).unwrap();

        insert_short_term_visits(
            &mut conn,
            &[
                visit("2026-01-01", "/", "alice"),
                visit("2026-01-01", "/", "alice"),
                visit("2026-01-01", "/", "bob"),
            ],
        )
        .unwrap();

        let totals = short_term_totals_since(&conn, None).unwrap();
        assert_eq!(totals.get("/"), Some(&2));
    }

    #[test]
    fn insert_short_term_visits_distinguishes_by_path() {
        let (_dir, path) = temp_db();
        let mut conn = open(&path).unwrap();

        insert_short_term_visits(
            &mut conn,
            &[
                visit("2026-01-01", "/", "alice"),
                visit("2026-01-01", "/about-me", "alice"),
            ],
        )
        .unwrap();

        let totals = short_term_totals_since(&conn, None).unwrap();
        assert_eq!(totals.get("/"), Some(&1));
        assert_eq!(totals.get("/about-me"), Some(&1));
    }

    #[test]
    fn short_term_totals_since_none_counts_every_day() {
        let (_dir, path) = temp_db();
        let mut conn = open(&path).unwrap();
        insert_short_term_visits(
            &mut conn,
            &[
                visit("2020-01-01", "/", "alice"),
                visit("2026-01-01", "/", "bob"),
            ],
        )
        .unwrap();

        let totals = short_term_totals_since(&conn, None).unwrap();
        assert_eq!(totals.get("/"), Some(&2));
    }

    #[test]
    fn short_term_totals_since_a_watermark_excludes_older_days() {
        let (_dir, path) = temp_db();
        let mut conn = open(&path).unwrap();
        insert_short_term_visits(
            &mut conn,
            &[
                visit("2026-01-01", "/", "alice"),
                visit("2026-01-02", "/", "bob"),
                visit("2026-01-03", "/", "carol"),
            ],
        )
        .unwrap();

        let totals = short_term_totals_since(&conn, Some(date("2026-01-01"))).unwrap();
        assert_eq!(totals.get("/"), Some(&2));
    }

    #[test]
    fn prune_short_term_visits_through_deletes_only_older_or_equal_days() {
        let (_dir, path) = temp_db();
        let mut conn = open(&path).unwrap();
        insert_short_term_visits(
            &mut conn,
            &[
                visit("2026-01-01", "/", "alice"),
                visit("2026-01-02", "/", "bob"),
            ],
        )
        .unwrap();

        let deleted = prune_short_term_visits_through(&conn, date("2026-01-01")).unwrap();
        assert_eq!(deleted, 1);

        let totals = short_term_totals_since(&conn, None).unwrap();
        assert_eq!(totals.get("/"), Some(&1));
    }

    #[test]
    fn load_or_create_hash_secret_generates_a_32_byte_secret() {
        let (_dir, path) = temp_db();
        let conn = open(&path).unwrap();
        let secret = load_or_create_hash_secret(&conn).unwrap();
        assert_eq!(secret.len(), HASH_SECRET_LEN);
    }

    #[test]
    fn load_or_create_hash_secret_is_stable_across_calls_on_the_same_connection() {
        let (_dir, path) = temp_db();
        let conn = open(&path).unwrap();
        let first = load_or_create_hash_secret(&conn).unwrap();
        let second = load_or_create_hash_secret(&conn).unwrap();
        assert_eq!(first, second);
    }

    #[test]
    fn load_or_create_hash_secret_persists_across_a_reopen() {
        let (_dir, path) = temp_db();
        let first = {
            let conn = open(&path).unwrap();
            load_or_create_hash_secret(&conn).unwrap()
        };
        let second = {
            let conn = open(&path).unwrap();
            load_or_create_hash_secret(&conn).unwrap()
        };
        assert_eq!(first, second);
    }

    #[tokio::test]
    async fn spawn_writer_batches_events_into_the_database() {
        let (_dir, path) = temp_db();
        // Pre-create the schema/pragmas on the main test connection before
        // handing the same path to the background writer.
        open(&path).unwrap();

        let sender = spawn_writer(path.clone());
        for i in 0..5 {
            sender
                .send(visit("2026-01-01", "/", &format!("visitor-{i}")))
                .await
                .unwrap();
        }
        drop(sender);

        // Poll rather than sleep a fixed amount: the writer batches on its
        // own schedule, so wait for the effect instead of guessing a delay.
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        loop {
            let conn = open(&path).unwrap();
            let totals = short_term_totals_since(&conn, None).unwrap();
            if totals.get("/") == Some(&5) {
                break;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "writer did not persist all events in time; saw {totals:?}"
            );
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
    }

    #[test]
    fn store_error_display_includes_the_underlying_error() {
        let io_err = StoreError::Io(std::io::Error::other("boom"));
        assert!(io_err.to_string().contains("boom"));

        let sqlite_err = StoreError::Sqlite(rusqlite::Error::QueryReturnedNoRows);
        assert!(sqlite_err.to_string().contains("Query returned no rows"));
    }
}
