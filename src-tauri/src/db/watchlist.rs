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
}

pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS watchlist (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            domain          TEXT NOT NULL,
            tld             TEXT NOT NULL,
            added_at        TEXT NOT NULL,
            last_checked_at TEXT,
            last_status     TEXT,
            UNIQUE(domain, tld)
        );",
    )
}

/// Add domain+tld; ignores duplicates and returns the existing or new entry.
pub fn add(conn: &Connection, domain: &str, tld: &str, added_at: &str) -> Result<WatchlistEntry> {
    // Return existing if already present.
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
        "DELETE FROM watchlist WHERE id NOT IN (
            SELECT id FROM watchlist ORDER BY id DESC LIMIT ?1
         )",
        params![MAX_WATCHLIST],
    )?;

    Ok(WatchlistEntry {
        id,
        domain: domain.to_string(),
        tld: tld.to_string(),
        added_at: added_at.to_string(),
        last_checked_at: None,
        last_status: None,
    })
}

fn find_by_domain_tld(conn: &Connection, domain: &str, tld: &str) -> Result<Option<WatchlistEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, tld, added_at, last_checked_at, last_status
         FROM watchlist WHERE domain = ?1 AND tld = ?2",
    )?;
    let mut rows = stmt.query_map(params![domain, tld], row_to_entry)?;
    Ok(rows.next().transpose()?)
}

pub fn remove(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM watchlist WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_all(conn: &Connection) -> Result<Vec<WatchlistEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, tld, added_at, last_checked_at, last_status
         FROM watchlist ORDER BY id DESC",
    )?;
    let rows = stmt.query_map([], row_to_entry)?;
    rows.collect()
}

pub fn update(conn: &Connection, id: i64, last_checked_at: &str, last_status: &str) -> Result<()> {
    conn.execute(
        "UPDATE watchlist SET last_checked_at = ?1, last_status = ?2 WHERE id = ?3",
        params![last_checked_at, last_status, id],
    )?;
    Ok(())
}

fn row_to_entry(row: &rusqlite::Row) -> rusqlite::Result<WatchlistEntry> {
    Ok(WatchlistEntry {
        id: row.get(0)?,
        domain: row.get(1)?,
        tld: row.get(2)?,
        added_at: row.get(3)?,
        last_checked_at: row.get(4)?,
        last_status: row.get(5)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        create_table(&conn).unwrap();
        conn
    }

    #[test]
    fn add_and_get() {
        let conn = setup();
        let e = add(&conn, "example", "com", "2026-01-01T00:00:00Z").unwrap();
        assert_eq!(e.domain, "example");
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
    fn update_status() {
        let conn = setup();
        let e = add(&conn, "foo", "io", "2026-01-01T00:00:00Z").unwrap();
        update(&conn, e.id, "2026-01-02T00:00:00Z", "available").unwrap();
        assert_eq!(get_all(&conn).unwrap()[0].last_status.as_deref(), Some("available"));
    }

    #[test]
    fn enforces_max_200() {
        let conn = setup();
        for i in 0..205usize {
            add(&conn, &format!("d{i}"), "com", "t").unwrap();
        }
        assert!(get_all(&conn).unwrap().len() <= 200);
    }
}
