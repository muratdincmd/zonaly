use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

const MAX_SESSIONS: i64 = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSession {
    pub id: i64,
    pub name: String,
    pub domains: Vec<String>,
    pub tld_list: Vec<String>,
    pub created_at: String,
}

pub fn create_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS sessions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            domains    TEXT NOT NULL,
            tld_list   TEXT NOT NULL,
            created_at TEXT NOT NULL
        );",
    )
}

pub fn save(
    conn: &Connection,
    name: &str,
    domains: &[String],
    tld_list: &[String],
    created_at: &str,
) -> Result<SavedSession> {
    let domains_json = serde_json::to_string(domains).unwrap_or_default();
    let tlds_json = serde_json::to_string(tld_list).unwrap_or_default();

    conn.execute(
        "INSERT INTO sessions (name, domains, tld_list, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![name, domains_json, tlds_json, created_at],
    )?;

    let id = conn.last_insert_rowid();

    // Prune oldest rows beyond MAX_SESSIONS.
    conn.execute(
        "DELETE FROM sessions WHERE id NOT IN (
            SELECT id FROM sessions ORDER BY id DESC LIMIT ?1
         )",
        params![MAX_SESSIONS],
    )?;

    Ok(SavedSession {
        id,
        name: name.to_string(),
        domains: domains.to_vec(),
        tld_list: tld_list.to_vec(),
        created_at: created_at.to_string(),
    })
}

pub fn get_all(conn: &Connection) -> Result<Vec<SavedSession>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, domains, tld_list, created_at FROM sessions ORDER BY id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let domains_json: String = row.get(2)?;
        let tlds_json: String = row.get(3)?;
        Ok(SavedSession {
            id: row.get(0)?,
            name: row.get(1)?,
            domains: serde_json::from_str(&domains_json).unwrap_or_default(),
            tld_list: serde_json::from_str(&tlds_json).unwrap_or_default(),
            created_at: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn rename(conn: &Connection, id: i64, name: &str) -> Result<()> {
    conn.execute("UPDATE sessions SET name = ?1 WHERE id = ?2", params![name, id])?;
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
    fn save_and_get() {
        let conn = setup();
        let s = save(&conn, "My Session", &["example".into()], &["com".into()], "2026-01-01T00:00:00Z").unwrap();
        assert_eq!(s.name, "My Session");
        assert_eq!(get_all(&conn).unwrap().len(), 1);
    }

    #[test]
    fn delete_session() {
        let conn = setup();
        let s = save(&conn, "Del", &["x".into()], &["net".into()], "2026-01-01T00:00:00Z").unwrap();
        delete(&conn, s.id).unwrap();
        assert!(get_all(&conn).unwrap().is_empty());
    }

    #[test]
    fn rename_session() {
        let conn = setup();
        let s = save(&conn, "Old", &["x".into()], &["io".into()], "2026-01-01T00:00:00Z").unwrap();
        rename(&conn, s.id, "New").unwrap();
        assert_eq!(get_all(&conn).unwrap()[0].name, "New");
    }

    #[test]
    fn enforces_max_50() {
        let conn = setup();
        for i in 0..55usize {
            save(&conn, &format!("s{i}"), &["x".into()], &["com".into()], "t").unwrap();
        }
        assert!(get_all(&conn).unwrap().len() <= 50);
    }
}
