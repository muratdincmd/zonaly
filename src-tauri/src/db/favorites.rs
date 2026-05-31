use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteEntry {
    pub id: i64,
    pub domain: String,
    pub tld: String,
    pub full_domain: String,
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
pub struct FavoriteAlert {
    pub id: i64,
    pub favorite_id: i64,
    pub alert_type: String,
    pub message: String,
    pub created_at: String,
    pub read_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteStats {
    pub total: usize,
    pub unread_alerts: usize,
    pub due_for_check: usize,
}

pub fn create_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS favorites (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            domain               TEXT    NOT NULL,
            tld                  TEXT    NOT NULL,
            full_domain          TEXT    NOT NULL,
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
        CREATE TABLE IF NOT EXISTS favorite_alerts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            favorite_id INTEGER NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
            alert_type  TEXT    NOT NULL,
            message     TEXT    NOT NULL,
            created_at  TEXT    NOT NULL,
            read_at     TEXT
        );",
    )
}

pub fn add(
    conn: &Connection,
    domain: &str,
    tld: &str,
    notes: Option<&str>,
    added_at: &str,
) -> Result<FavoriteEntry> {
    let full_domain = format!("{domain}.{tld}");
    // Return existing if already present
    if let Some(existing) = find_by_domain_tld(conn, domain, tld)? {
        return Ok(existing);
    }
    conn.execute(
        "INSERT INTO favorites (domain, tld, full_domain, added_at, notes)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![domain, tld, full_domain, added_at, notes],
    )?;
    let id = conn.last_insert_rowid();
    Ok(FavoriteEntry {
        id,
        domain: domain.to_string(),
        tld: tld.to_string(),
        full_domain,
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
        notes: notes.map(str::to_string),
    })
}

pub fn remove(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM favorites WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_all(conn: &Connection) -> Result<Vec<FavoriteEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, tld, full_domain, added_at, last_checked_at, last_status,
                last_registrar, last_expiry_date, check_interval_hours, next_check_at,
                alert_on_available, alert_on_expiry, alert_on_change, expiry_alert_days, notes
         FROM favorites ORDER BY id DESC",
    )?;
    let rows = stmt.query_map([], row_to_entry)?;
    rows.collect()
}

pub fn get_stats(conn: &Connection) -> Result<FavoriteStats> {
    let total: usize = conn.query_row(
        "SELECT COUNT(*) FROM favorites",
        [],
        |r| r.get::<_, i64>(0),
    )? as usize;

    let unread_alerts: usize = conn.query_row(
        "SELECT COUNT(*) FROM favorite_alerts WHERE read_at IS NULL",
        [],
        |r| r.get::<_, i64>(0),
    )? as usize;

    let now = crate::commands::chrono_now_pub();
    let due_for_check: usize = conn.query_row(
        "SELECT COUNT(*) FROM favorites WHERE next_check_at IS NOT NULL AND next_check_at <= ?1",
        params![now],
        |r| r.get::<_, i64>(0),
    )? as usize;

    Ok(FavoriteStats { total, unread_alerts, due_for_check })
}

pub fn update_settings(
    conn: &Connection,
    id: i64,
    check_interval_hours: i64,
    alert_on_available: bool,
    alert_on_expiry: bool,
    alert_on_change: bool,
    expiry_alert_days: i64,
    notes: Option<&str>,
) -> Result<FavoriteEntry> {
    conn.execute(
        "UPDATE favorites SET
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

pub fn update_check_result(
    conn: &Connection,
    id: i64,
    now: &str,
    status: &str,
    registrar: Option<&str>,
    expiry_date: Option<&str>,
    next_check_at: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE favorites SET
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

pub fn get_due(conn: &Connection, now: &str) -> Result<Vec<FavoriteEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, tld, full_domain, added_at, last_checked_at, last_status,
                last_registrar, last_expiry_date, check_interval_hours, next_check_at,
                alert_on_available, alert_on_expiry, alert_on_change, expiry_alert_days, notes
         FROM favorites
         WHERE next_check_at IS NULL OR next_check_at <= ?1",
    )?;
    let rows = stmt.query_map(params![now], row_to_entry)?;
    rows.collect()
}

pub fn is_favorited(conn: &Connection, domain: &str, tld: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM favorites WHERE domain = ?1 AND tld = ?2",
        params![domain, tld],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

// ── Alerts ────────────────────────────────────────────────────────────────────

pub fn insert_alert(
    conn: &Connection,
    favorite_id: i64,
    alert_type: &str,
    message: &str,
    created_at: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO favorite_alerts (favorite_id, alert_type, message, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![favorite_id, alert_type, message, created_at],
    )?;
    Ok(())
}

/// Returns true if an unread expiry alert already exists for this favorite
/// within the current expiry window (avoids duplicate alerts per cycle).
pub fn expiry_alert_exists(conn: &Connection, favorite_id: i64) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM favorite_alerts
         WHERE favorite_id = ?1 AND alert_type = 'expiry' AND read_at IS NULL",
        params![favorite_id],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

pub fn get_alerts(conn: &Connection, unread_only: bool) -> Result<Vec<FavoriteAlert>> {
    let sql = if unread_only {
        "SELECT id, favorite_id, alert_type, message, created_at, read_at
         FROM favorite_alerts WHERE read_at IS NULL ORDER BY id DESC"
    } else {
        "SELECT id, favorite_id, alert_type, message, created_at, read_at
         FROM favorite_alerts ORDER BY id DESC"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |row| {
        Ok(FavoriteAlert {
            id: row.get(0)?,
            favorite_id: row.get(1)?,
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
        "UPDATE favorite_alerts SET read_at = ?1 WHERE id = ?2",
        params![now, alert_id],
    )?;
    Ok(())
}

pub fn mark_all_alerts_read(conn: &Connection, now: &str) -> Result<()> {
    conn.execute(
        "UPDATE favorite_alerts SET read_at = ?1 WHERE read_at IS NULL",
        params![now],
    )?;
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn find_by_domain_tld(conn: &Connection, domain: &str, tld: &str) -> Result<Option<FavoriteEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, tld, full_domain, added_at, last_checked_at, last_status,
                last_registrar, last_expiry_date, check_interval_hours, next_check_at,
                alert_on_available, alert_on_expiry, alert_on_change, expiry_alert_days, notes
         FROM favorites WHERE domain = ?1 AND tld = ?2",
    )?;
    let mut rows = stmt.query_map(params![domain, tld], row_to_entry)?;
    rows.next().transpose()
}

fn get_by_id(conn: &Connection, id: i64) -> Result<FavoriteEntry> {
    conn.query_row(
        "SELECT id, domain, tld, full_domain, added_at, last_checked_at, last_status,
                last_registrar, last_expiry_date, check_interval_hours, next_check_at,
                alert_on_available, alert_on_expiry, alert_on_change, expiry_alert_days, notes
         FROM favorites WHERE id = ?1",
        params![id],
        row_to_entry,
    )
}

fn row_to_entry(row: &rusqlite::Row) -> rusqlite::Result<FavoriteEntry> {
    Ok(FavoriteEntry {
        id: row.get(0)?,
        domain: row.get(1)?,
        tld: row.get(2)?,
        full_domain: row.get(3)?,
        added_at: row.get(4)?,
        last_checked_at: row.get(5)?,
        last_status: row.get(6)?,
        last_registrar: row.get(7)?,
        last_expiry_date: row.get(8)?,
        check_interval_hours: row.get(9)?,
        next_check_at: row.get(10)?,
        alert_on_available: row.get::<_, i64>(11)? != 0,
        alert_on_expiry: row.get::<_, i64>(12)? != 0,
        alert_on_change: row.get::<_, i64>(13)? != 0,
        expiry_alert_days: row.get(14)?,
        notes: row.get(15)?,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();
        conn
    }

    #[test]
    fn test_add_favorite() {
        let conn = setup();
        let e = add(&conn, "example", "com", None, "2026-01-01T00:00:00Z").unwrap();
        assert_eq!(e.domain, "example");
        assert_eq!(e.tld, "com");
        assert_eq!(e.full_domain, "example.com");
        assert_eq!(e.check_interval_hours, 24);
        assert!(e.alert_on_available);
        assert!(e.alert_on_expiry);
        assert!(e.alert_on_change);
        let all = get_all(&conn).unwrap();
        assert_eq!(all.len(), 1);
    }

    #[test]
    fn test_duplicate_favorite() {
        let conn = setup();
        add(&conn, "example", "com", None, "2026-01-01T00:00:00Z").unwrap();
        let e2 = add(&conn, "example", "com", None, "2026-01-02T00:00:00Z").unwrap();
        // Should return existing, not insert duplicate
        assert_eq!(e2.added_at, "2026-01-01T00:00:00Z");
        assert_eq!(get_all(&conn).unwrap().len(), 1);
    }

    #[test]
    fn test_remove_favorite() {
        let conn = setup();
        let e = add(&conn, "test", "net", None, "2026-01-01T00:00:00Z").unwrap();
        remove(&conn, e.id).unwrap();
        assert!(get_all(&conn).unwrap().is_empty());
    }

    #[test]
    fn test_favorite_settings_update() {
        let conn = setup();
        let e = add(&conn, "foo", "io", None, "2026-01-01T00:00:00Z").unwrap();
        let updated = update_settings(&conn, e.id, 12, false, true, false, 14, Some("my note")).unwrap();
        assert_eq!(updated.check_interval_hours, 12);
        assert!(!updated.alert_on_available);
        assert!(updated.alert_on_expiry);
        assert!(!updated.alert_on_change);
        assert_eq!(updated.expiry_alert_days, 14);
        assert_eq!(updated.notes.as_deref(), Some("my note"));
    }

    #[test]
    fn test_check_due_logic() {
        let conn = setup();
        let e = add(&conn, "due", "org", None, "2026-01-01T00:00:00Z").unwrap();
        // Set next_check_at in the past
        update_check_result(&conn, e.id, "2026-01-01T00:00:00Z", "taken", None, None, "2020-01-01T00:00:00Z").unwrap();
        let due = get_due(&conn, "2026-06-01T00:00:00Z").unwrap();
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].domain, "due");
    }

    #[test]
    fn test_alert_generation() {
        let conn = setup();
        let e = add(&conn, "alert", "com", None, "2026-01-01T00:00:00Z").unwrap();
        insert_alert(&conn, e.id, "available", "alert.com is now available!", "2026-01-02T00:00:00Z").unwrap();
        let alerts = get_alerts(&conn, true).unwrap();
        assert_eq!(alerts.len(), 1);
        assert_eq!(alerts[0].alert_type, "available");
        assert!(alerts[0].read_at.is_none());
    }

    #[test]
    fn test_mark_alert_read() {
        let conn = setup();
        let e = add(&conn, "read", "dev", None, "2026-01-01T00:00:00Z").unwrap();
        insert_alert(&conn, e.id, "status_change", "Status changed", "2026-01-02T00:00:00Z").unwrap();
        let alert = get_alerts(&conn, false).unwrap().into_iter().next().unwrap();
        mark_alert_read(&conn, alert.id, "2026-01-03T00:00:00Z").unwrap();
        let unread = get_alerts(&conn, true).unwrap();
        assert!(unread.is_empty());
        let all = get_alerts(&conn, false).unwrap();
        assert!(all[0].read_at.is_some());
    }

    #[test]
    fn test_is_favorited() {
        let conn = setup();
        assert!(!is_favorited(&conn, "example", "com").unwrap());
        add(&conn, "example", "com", None, "2026-01-01T00:00:00Z").unwrap();
        assert!(is_favorited(&conn, "example", "com").unwrap());
        assert!(!is_favorited(&conn, "example", "net").unwrap());
    }

    #[test]
    fn test_mark_all_alerts_read() {
        let conn = setup();
        let e = add(&conn, "bulk", "com", None, "2026-01-01T00:00:00Z").unwrap();
        insert_alert(&conn, e.id, "available", "msg1", "2026-01-01T00:00:00Z").unwrap();
        insert_alert(&conn, e.id, "expiry", "msg2", "2026-01-01T00:00:00Z").unwrap();
        mark_all_alerts_read(&conn, "2026-01-02T00:00:00Z").unwrap();
        assert!(get_alerts(&conn, true).unwrap().is_empty());
    }
}
