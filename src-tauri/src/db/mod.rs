pub mod favorites;
pub mod history;
pub mod sessions;
pub mod watchlist;

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;

pub use favorites::{FavoriteAlert, FavoriteEntry, FavoriteStats};
pub use history::HistoryEntry;
pub use sessions::SavedSession;
pub use watchlist::WatchlistEntry;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn open(db_path: PathBuf) -> Result<Self, String> {
        eprintln!("[zonaly] Opening database at: {}", db_path.display());

        let conn = Connection::open(&db_path).map_err(|e| {
            eprintln!("[zonaly] Failed to open database at {}: {e}", db_path.display());
            e.to_string()
        })?;

        // Enable WAL for better concurrent read/write performance.
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| e.to_string())?;

        history::create_table(&conn).map_err(|e| e.to_string())?;
        sessions::create_table(&conn).map_err(|e| e.to_string())?;
        watchlist::create_table(&conn).map_err(|e| e.to_string())?;
        favorites::create_tables(&conn).map_err(|e| e.to_string())?;

        eprintln!("[zonaly] Database ready at: {}", db_path.display());
        Ok(Self { conn: Mutex::new(conn) })
    }
}
