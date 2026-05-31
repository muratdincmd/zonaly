use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

const MAX_HISTORY: i64 = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    pub timestamp: String,
    pub domains: Vec<String>,
    pub tld_list: Vec<String>,
    pub available_count: i64,
    pub taken_count: i64,
    pub error_count: i64,
}

pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS history (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       TEXT    NOT NULL,
            domains         TEXT    NOT NULL,
            tld_list        TEXT    NOT NULL,
            available_count INTEGER NOT NULL DEFAULT 0,
            taken_count     INTEGER NOT NULL DEFAULT 0,
            error_count     INTEGER NOT NULL DEFAULT 0
        );",
    )
}

pub fn add(
    conn: &Connection,
    timestamp: &str,
    domains: &[String],
    tld_list: &[String],
    available_count: i64,
    taken_count: i64,
    error_count: i64,
) -> Result<HistoryEntry> {
    let domains_json = serde_json::to_string(domains).unwrap_or_default();
    let tlds_json = serde_json::to_string(tld_list).unwrap_or_default();

    conn.execute(
        "INSERT INTO history (timestamp, domains, tld_list, available_count, taken_count, error_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![timestamp, domains_json, tlds_json, available_count, taken_count, error_count],
    )?;

    let id = conn.last_insert_rowid();

    // Prune oldest rows beyond MAX_HISTORY.
    conn.execute(
        "DELETE FROM history WHERE id NOT IN (
            SELECT id FROM history ORDER BY id DESC LIMIT ?1
         )",
        params![MAX_HISTORY],
    )?;

    Ok(HistoryEntry {
        id,
        timestamp: timestamp.to_string(),
        domains: domains.to_vec(),
        tld_list: tld_list.to_vec(),
        available_count,
        taken_count,
        error_count,
    })
}

pub fn get_all(conn: &Connection) -> Result<Vec<HistoryEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, timestamp, domains, tld_list, available_count, taken_count, error_count
         FROM history ORDER BY id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let domains_json: String = row.get(2)?;
        let tlds_json: String = row.get(3)?;
        Ok(HistoryEntry {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            domains: serde_json::from_str(&domains_json).unwrap_or_default(),
            tld_list: serde_json::from_str(&tlds_json).unwrap_or_default(),
            available_count: row.get(4)?,
            taken_count: row.get(5)?,
            error_count: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM history WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn clear(conn: &Connection) -> Result<()> {
    conn.execute_batch("DELETE FROM history;")?;
    Ok(())
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
        add(&conn, "2026-01-01T00:00:00Z", &["example".into()], &["com".into()], 1, 0, 0).unwrap();
        add(&conn, "2026-01-02T00:00:00Z", &["test".into()], &["net".into()], 0, 1, 0).unwrap();
        let entries = get_all(&conn).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].domains, vec!["test"]); // newest first
    }

    #[test]
    fn delete_entry() {
        let conn = setup();
        let e = add(&conn, "2026-01-01T00:00:00Z", &["a".into()], &["com".into()], 1, 0, 0).unwrap();
        delete(&conn, e.id).unwrap();
        assert!(get_all(&conn).unwrap().is_empty());
    }

    #[test]
    fn clear_all() {
        let conn = setup();
        for _ in 0..5 {
            add(&conn, "t", &["x".into()], &["io".into()], 0, 1, 0).unwrap();
        }
        clear(&conn).unwrap();
        assert!(get_all(&conn).unwrap().is_empty());
    }

    #[test]
    fn enforces_max_100() {
        let conn = setup();
        for _ in 0..105 {
            add(&conn, "t", &["x".into()], &["com".into()], 0, 0, 1).unwrap();
        }
        assert!(get_all(&conn).unwrap().len() <= 100);
    }
}
