use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

const MAX_WATCHLIST: i64 = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistEntry {
    pub id: i64,
    pub domain: String,
    pub tld: String,
    pub added_at: String,
    pub last_checked_at: Option<String>,
    pub last_status: Option<String>,
    pub last_registrar: Option<String>,
    pub last_expiry_date: Option<String>,
    pub check_interval_hours: i64,
    pub next_check_at: Option<String>,
    pub alert_on_available: bool,
    pub alert_on_expiry: bool,
    pub alert_on_change: bool,
    pub expiry_alert_days: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistAlert {
    pub id: i64,
    pub watchlist_id: i64,
    pub alert_type: String,
    pub message: String,
    pub created_at: String,
    pub read_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistStats {
    pub total: usize,
    pub unread_alerts: usize,
    pub due_for_check: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistSettings {
    pub check_interval_hours: i64,
    pub alert_on_available: bool,
    pub alert_on_expiry: bool,
    pub alert_on_change: bool,
    pub expiry_alert_days: i64,
    pub notes: Option<String>,
}

pub fn create_table(conn: &Connection) -> Result<()> {
    // Create tables (idempotent).
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS watchlist (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            domain               TEXT    NOT NULL,
            tld                  TEXT    NOT NULL,
            added_at             TEXT    NOT NULL,
            last_checked_at      TEXT,
            last_status          TEXT,
            last_registrar       TEXT,
            last_expiry_date     TEXT,
            check_interval_hours INTEGER NOT NULL DEFAULT 24,
            next_check_at        TEXT,
            alert_on_available   INTEGER NOT NULL DEFAULT 1,
            alert_on_expiry      INTEGER NOT NULL DEFAULT 1,
            alert_on_change      INTEGER NOT NULL DEFAULT 1,
            expiry_alert_days    INTEGER NOT NULL DEFAULT 30,
            notes                TEXT,
            UNIQUE(domain, tld)
        );
        CREATE TABLE IF NOT EXISTS watchlist_alerts (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            watchlist_id INTEGER NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
            alert_type   TEXT    NOT NULL,
            message      TEXT    NOT NULL,
            created_at   TEXT    NOT NULL,
            read_at      TEXT
        );",
    )?;

    // Migrate pre-v0.8 installs that only had the original 6 columns.
    // SQLite has no ALTER TABLE ADD COLUMN IF NOT EXISTS, so we ignore
    // "duplicate column name" errors (error code 1) on each statement.
    let migrations = [
        "ALTER TABLE watchlist ADD COLUMN last_registrar       TEXT",
        "ALTER TABLE watchlist ADD COLUMN last_expiry_date     TEXT",
        "ALTER TABLE watchlist ADD COLUMN check_interval_hours INTEGER NOT NULL DEFAULT 24",
        "ALTER TABLE watchlist ADD COLUMN next_check_at        TEXT",
        "ALTER TABLE watchlist ADD COLUMN alert_on_available   INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE watchlist ADD COLUMN alert_on_expiry      INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE watchlist ADD COLUMN alert_on_change      INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE watchlist ADD COLUMN expiry_alert_days    INTEGER NOT NULL DEFAULT 30",
        "ALTER TABLE watchlist ADD COLUMN notes                TEXT",
    ];
    for sql in &migrations {
        if let Err(e) = conn.execute_batch(sql) {
            // Code 1 = "duplicate column name" — column already exists, skip.
            if !e.to_string().contains("duplicate column name") {
                return Err(e);
            }
        }
    }

    Ok(())
}

/// Add domain+tld; returns existing entry if already present.
pub fn add(conn: &Connection, domain: &str, tld: &str, added_at: &str) -> Result<WatchlistEntry> {
    if let Some(existing) = find_by_domain_tld(conn, domain, tld)? {
        return Ok(existing);
    }
    conn.execute(
        "INSERT INTO watchlist (domain, tld, added_at) VALUES (?1, ?2, ?3)",
        params![domain, tld, added_at],
    )?;
    let id = conn.last_insert_rowid();
    // Prune oldest rows beyond MAX_WATCHLIST.
    conn.execute(
        "DELETE FROM watchlist WHERE id NOT IN (SELECT id FROM watchlist ORDER BY id DESC LIMIT ?1)",
        params![MAX_WATCHLIST],
    )?;
    Ok(WatchlistEntry {
        id,
        domain: domain.to_string(),
        tld: tld.to_string(),
        added_at: added_at.to_string(),
        last_checked_at: None,
        last_status: None,
        last_registrar: None,
        last_expiry_date: None,
        check_interval_hours: 24,
        next_check_at: None,
        alert_on_available: true,
        alert_on_expiry: true,
        alert_on_change: true,
        expiry_alert_days: 30,
        notes: None,
    })
}

pub fn remove(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM watchlist WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_all(conn: &Connection) -> Result<Vec<WatchlistEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, tld, added_at, last_checked_at, last_status,
                last_registrar, last_expiry_date, check_interval_hours, next_check_at,
                alert_on_available, alert_on_expiry, alert_on_change, expiry_alert_days, notes
         FROM watchlist ORDER BY id DESC",
    )?;
    let rows = stmt.query_map([], row_to_entry)?;
    rows.collect()
}

pub fn get_stats(conn: &Connection, now: &str) -> Result<WatchlistStats> {
    let total: usize = conn.query_row("SELECT COUNT(*) FROM watchlist", [], |r| r.get::<_, i64>(0))? as usize;
    let unread_alerts: usize = conn.query_row(
        "SELECT COUNT(*) FROM watchlist_alerts WHERE read_at IS NULL",
        [], |r| r.get::<_, i64>(0),
    )? as usize;
    let due_for_check: usize = conn.query_row(
        "SELECT COUNT(*) FROM watchlist WHERE next_check_at IS NULL OR next_check_at <= ?1",
        params![now], |r| r.get::<_, i64>(0),
    )? as usize;
    Ok(WatchlistStats { total, unread_alerts, due_for_check })
}

pub fn update_settings(
    conn: &Connection,
    id: i64,
    s: &WatchlistSettings,
) -> Result<WatchlistEntry> {
    let (check_interval_hours, alert_on_available, alert_on_expiry, alert_on_change,
         expiry_alert_days) = (s.check_interval_hours, s.alert_on_available,
         s.alert_on_expiry, s.alert_on_change, s.expiry_alert_days);
    let notes = s.notes.as_deref();
    conn.execute(
        "UPDATE watchlist SET
            check_interval_hours = ?1,
            alert_on_available   = ?2,
            alert_on_expiry      = ?3,
            alert_on_change      = ?4,
            expiry_alert_days    = ?5,
            notes                = ?6
         WHERE id = ?7",
        params![
            check_interval_hours,
            alert_on_available as i64,
            alert_on_expiry as i64,
            alert_on_change as i64,
            expiry_alert_days,
            notes,
            id
        ],
    )?;
    get_by_id(conn, id)
}

pub fn update(conn: &Connection, id: i64, last_checked_at: &str, last_status: &str) -> Result<()> {
    conn.execute(
        "UPDATE watchlist SET last_checked_at = ?1, last_status = ?2 WHERE id = ?3",
        params![last_checked_at, last_status, id],
    )?;
    Ok(())
}

pub fn update_full(
    conn: &Connection,
    id: i64,
    now: &str,
    status: &str,
    registrar: Option<&str>,
    expiry_date: Option<&str>,
    next_check_at: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE watchlist SET
            last_checked_at  = ?1,
            last_status      = ?2,
            last_registrar   = ?3,
            last_expiry_date = ?4,
            next_check_at    = ?5
         WHERE id = ?6",
        params![now, status, registrar, expiry_date, next_check_at, id],
    )?;
    Ok(())
}

pub fn get_due(conn: &Connection, now: &str) -> Result<Vec<WatchlistEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, tld, added_at, last_checked_at, last_status,
                last_registrar, last_expiry_date, check_interval_hours, next_check_at,
                alert_on_available, alert_on_expiry, alert_on_change, expiry_alert_days, notes
         FROM watchlist WHERE next_check_at IS NULL OR next_check_at <= ?1",
    )?;
    let rows = stmt.query_map(params![now], row_to_entry)?;
    rows.collect()
}

// ── Alerts ────────────────────────────────────────────────────────────────────

pub fn insert_alert(
    conn: &Connection,
    watchlist_id: i64,
    alert_type: &str,
    message: &str,
    created_at: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO watchlist_alerts (watchlist_id, alert_type, message, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![watchlist_id, alert_type, message, created_at],
    )?;
    Ok(())
}

pub fn expiry_alert_exists(conn: &Connection, watchlist_id: i64) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM watchlist_alerts
         WHERE watchlist_id = ?1 AND alert_type = 'expiry' AND read_at IS NULL",
        params![watchlist_id],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

pub fn get_alerts(conn: &Connection, unread_only: bool) -> Result<Vec<WatchlistAlert>> {
    let sql = if unread_only {
        "SELECT id, watchlist_id, alert_type, message, created_at, read_at
         FROM watchlist_alerts WHERE read_at IS NULL ORDER BY id DESC"
    } else {
        "SELECT id, watchlist_id, alert_type, message, created_at, read_at
         FROM watchlist_alerts ORDER BY id DESC"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |row| {
        Ok(WatchlistAlert {
            id: row.get(0)?,
            watchlist_id: row.get(1)?,
            alert_type: row.get(2)?,
            message: row.get(3)?,
            created_at: row.get(4)?,
            read_at: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn mark_alert_read(conn: &Connection, alert_id: i64, now: &str) -> Result<()> {
    conn.execute(
        "UPDATE watchlist_alerts SET read_at = ?1 WHERE id = ?2",
        params![now, alert_id],
    )?;
    Ok(())
}

pub fn mark_all_alerts_read(conn: &Connection, now: &str) -> Result<()> {
    conn.execute(
        "UPDATE watchlist_alerts SET read_at = ?1 WHERE read_at IS NULL",
        params![now],
    )?;
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn find_by_domain_tld(conn: &Connection, domain: &str, tld: &str) -> Result<Option<WatchlistEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, tld, added_at, last_checked_at, last_status,
                last_registrar, last_expiry_date, check_interval_hours, next_check_at,
                alert_on_available, alert_on_expiry, alert_on_change, expiry_alert_days, notes
         FROM watchlist WHERE domain = ?1 AND tld = ?2",
    )?;
    let mut rows = stmt.query_map(params![domain, tld], row_to_entry)?;
    rows.next().transpose()
}

fn get_by_id(conn: &Connection, id: i64) -> Result<WatchlistEntry> {
    conn.query_row(
        "SELECT id, domain, tld, added_at, last_checked_at, last_status,
                last_registrar, last_expiry_date, check_interval_hours, next_check_at,
                alert_on_available, alert_on_expiry, alert_on_change, expiry_alert_days, notes
         FROM watchlist WHERE id = ?1",
        params![id],
        row_to_entry,
    )
}

fn row_to_entry(row: &rusqlite::Row) -> rusqlite::Result<WatchlistEntry> {
    Ok(WatchlistEntry {
        id: row.get(0)?,
        domain: row.get(1)?,
        tld: row.get(2)?,
        added_at: row.get(3)?,
        last_checked_at: row.get(4)?,
        last_status: row.get(5)?,
        last_registrar: row.get(6)?,
        last_expiry_date: row.get(7)?,
        check_interval_hours: row.get::<_, Option<i64>>(8)?.unwrap_or(24),
        next_check_at: row.get(9)?,
        alert_on_available: row.get::<_, Option<i64>>(10)?.unwrap_or(1) != 0,
        alert_on_expiry: row.get::<_, Option<i64>>(11)?.unwrap_or(1) != 0,
        alert_on_change: row.get::<_, Option<i64>>(12)?.unwrap_or(1) != 0,
        expiry_alert_days: row.get::<_, Option<i64>>(13)?.unwrap_or(30),
        notes: row.get(14)?,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        // For tests, run only the CREATE TABLE parts (ALTER TABLE fails on fresh DB)
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS watchlist (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                domain               TEXT    NOT NULL,
                tld                  TEXT    NOT NULL,
                added_at             TEXT    NOT NULL,
                last_checked_at      TEXT,
                last_status          TEXT,
                last_registrar       TEXT,
                last_expiry_date     TEXT,
                check_interval_hours INTEGER NOT NULL DEFAULT 24,
                next_check_at        TEXT,
                alert_on_available   INTEGER NOT NULL DEFAULT 1,
                alert_on_expiry      INTEGER NOT NULL DEFAULT 1,
                alert_on_change      INTEGER NOT NULL DEFAULT 1,
                expiry_alert_days    INTEGER NOT NULL DEFAULT 30,
                notes                TEXT,
                UNIQUE(domain, tld)
            );
            CREATE TABLE IF NOT EXISTS watchlist_alerts (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                watchlist_id INTEGER NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
                alert_type   TEXT    NOT NULL,
                message      TEXT    NOT NULL,
                created_at   TEXT    NOT NULL,
                read_at      TEXT
            );",
        ).unwrap();
        conn
    }

    #[test]
    fn add_and_get() {
        let conn = setup();
        let e = add(&conn, "example", "com", "2026-01-01T00:00:00Z").unwrap();
        assert_eq!(e.domain, "example");
        assert_eq!(e.check_interval_hours, 24);
        assert!(e.alert_on_available);
        assert_eq!(get_all(&conn).unwrap().len(), 1);
    }

    #[test]
    fn duplicate_ignored() {
        let conn = setup();
        add(&conn, "example", "com", "2026-01-01T00:00:00Z").unwrap();
        add(&conn, "example", "com", "2026-01-02T00:00:00Z").unwrap();
        assert_eq!(get_all(&conn).unwrap().len(), 1);
    }

    #[test]
    fn remove_entry() {
        let conn = setup();
        let e = add(&conn, "test", "net", "2026-01-01T00:00:00Z").unwrap();
        remove(&conn, e.id).unwrap();
        assert!(get_all(&conn).unwrap().is_empty());
    }

    #[test]
    fn update_settings_persisted() {
        let conn = setup();
        let e = add(&conn, "foo", "io", "2026-01-01T00:00:00Z").unwrap();
        let updated = update_settings(&conn, e.id, &WatchlistSettings {
            check_interval_hours: 6,
            alert_on_available: false,
            alert_on_expiry: true,
            alert_on_change: false,
            expiry_alert_days: 14,
            notes: Some("my note".to_string()),
        }).unwrap();
        assert_eq!(updated.check_interval_hours, 6);
        assert!(!updated.alert_on_available);
        assert!(updated.alert_on_expiry);
        assert!(!updated.alert_on_change);
        assert_eq!(updated.expiry_alert_days, 14);
        assert_eq!(updated.notes.as_deref(), Some("my note"));
    }

    #[test]
    fn update_status() {
        let conn = setup();
        let e = add(&conn, "foo", "io", "2026-01-01T00:00:00Z").unwrap();
        update(&conn, e.id, "2026-01-02T00:00:00Z", "available").unwrap();
        assert_eq!(get_all(&conn).unwrap()[0].last_status.as_deref(), Some("available"));
    }

    #[test]
    fn due_check() {
        let conn = setup();
        let e = add(&conn, "due", "org", "2026-01-01T00:00:00Z").unwrap();
        update_full(&conn, e.id, "2026-01-01T00:00:00Z", "taken", None, None, "2020-01-01T00:00:00Z").unwrap();
        let due = get_due(&conn, "2026-06-01T00:00:00Z").unwrap();
        assert_eq!(due.len(), 1);
    }

    #[test]
    fn alert_insert_and_read() {
        let conn = setup();
        let e = add(&conn, "alert", "com", "2026-01-01T00:00:00Z").unwrap();
        insert_alert(&conn, e.id, "available", "Now available!", "2026-01-02T00:00:00Z").unwrap();
        let alerts = get_alerts(&conn, true).unwrap();
        assert_eq!(alerts.len(), 1);
        assert!(alerts[0].read_at.is_none());
    }

    #[test]
    fn mark_alert_read_works() {
        let conn = setup();
        let e = add(&conn, "read", "dev", "2026-01-01T00:00:00Z").unwrap();
        insert_alert(&conn, e.id, "change", "Changed!", "2026-01-02T00:00:00Z").unwrap();
        let alert = get_alerts(&conn, false).unwrap().into_iter().next().unwrap();
        mark_alert_read(&conn, alert.id, "2026-01-03T00:00:00Z").unwrap();
        assert!(get_alerts(&conn, true).unwrap().is_empty());
    }

    #[test]
    fn enforces_max_200() {
        let conn = setup();
        for i in 0..205usize { add(&conn, &format!("d{i}"), "com", "t").unwrap(); }
        assert!(get_all(&conn).unwrap().len() <= 200);
    }
}
