pub mod history;
pub mod sessions;
pub mod watchlist;

use std::sync::Mutex;

pub use history::HistoryEntry;
pub use sessions::SavedSession;
pub use watchlist::WatchlistEntry;

/// In-memory store for Phase 7 features.
///
/// NOTE: Data is not persisted between app restarts. SQLite persistence will
/// be added once the rusqlite build environment is confirmed working
/// (requires a C compiler toolchain for the bundled feature).
pub struct Database {
    pub history: Mutex<history::HistoryStore>,
    pub sessions: Mutex<sessions::SessionStore>,
    pub watchlist: Mutex<watchlist::WatchlistStore>,
}

impl Database {
    pub fn open(_db_path: std::path::PathBuf) -> Result<Self, String> {
        Ok(Self {
            history: Mutex::new(history::HistoryStore::new()),
            sessions: Mutex::new(sessions::SessionStore::new()),
            watchlist: Mutex::new(watchlist::WatchlistStore::new()),
        })
    }
}
