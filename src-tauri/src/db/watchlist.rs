use serde::{Deserialize, Serialize};

const MAX_WATCHLIST: usize = 200;

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

/// In-memory watchlist store (not persisted between restarts).
pub struct WatchlistStore {
    entries: Vec<WatchlistEntry>,
    next_id: i64,
}

impl WatchlistStore {
    pub fn new() -> Self {
        Self { entries: Vec::new(), next_id: 1 }
    }

    /// Add domain+tld; ignores duplicates and returns the existing or new entry.
    pub fn add(&mut self, domain: &str, tld: &str, added_at: &str) -> WatchlistEntry {
        // Return existing if already present
        if let Some(existing) = self.entries.iter().find(|e| e.domain == domain && e.tld == tld) {
            return existing.clone();
        }
        let entry = WatchlistEntry {
            id: self.next_id,
            domain: domain.to_string(),
            tld: tld.to_string(),
            added_at: added_at.to_string(),
            last_checked_at: None,
            last_status: None,
        };
        self.next_id += 1;
        self.entries.push(entry.clone());
        while self.entries.len() > MAX_WATCHLIST {
            self.entries.remove(0);
        }
        entry
    }

    pub fn remove(&mut self, id: i64) {
        self.entries.retain(|e| e.id != id);
    }

    pub fn get_all(&self) -> Vec<WatchlistEntry> {
        self.entries.iter().rev().cloned().collect()
    }

    pub fn update(&mut self, id: i64, last_checked_at: &str, last_status: &str) {
        if let Some(e) = self.entries.iter_mut().find(|e| e.id == id) {
            e.last_checked_at = Some(last_checked_at.to_string());
            e.last_status = Some(last_status.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_and_get() {
        let mut store = WatchlistStore::new();
        let e = store.add("example", "com", "2026-01-01T00:00:00Z");
        assert_eq!(e.domain, "example");
        assert_eq!(store.get_all().len(), 1);
    }

    #[test]
    fn duplicate_ignored() {
        let mut store = WatchlistStore::new();
        store.add("example", "com", "2026-01-01T00:00:00Z");
        store.add("example", "com", "2026-01-02T00:00:00Z");
        assert_eq!(store.get_all().len(), 1);
    }

    #[test]
    fn remove_entry() {
        let mut store = WatchlistStore::new();
        let e = store.add("test", "net", "2026-01-01T00:00:00Z");
        store.remove(e.id);
        assert!(store.get_all().is_empty());
    }

    #[test]
    fn update_status() {
        let mut store = WatchlistStore::new();
        let e = store.add("foo", "io", "2026-01-01T00:00:00Z");
        store.update(e.id, "2026-01-02T00:00:00Z", "available");
        assert_eq!(store.get_all()[0].last_status.as_deref(), Some("available"));
    }

    #[test]
    fn enforces_max_200() {
        let mut store = WatchlistStore::new();
        for i in 0..205usize { store.add(&format!("d{i}"), "com", "t"); }
        assert!(store.get_all().len() <= 200);
    }
}
