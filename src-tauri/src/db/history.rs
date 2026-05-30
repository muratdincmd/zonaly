use serde::{Deserialize, Serialize};

const MAX_HISTORY: usize = 100;

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

/// In-memory history store (not persisted between restarts).
pub struct HistoryStore {
    entries: Vec<HistoryEntry>,
    next_id: i64,
}

impl HistoryStore {
    pub fn new() -> Self {
        Self { entries: Vec::new(), next_id: 1 }
    }

    pub fn add(
        &mut self,
        timestamp: &str,
        domains: &[String],
        tld_list: &[String],
        available_count: i64,
        taken_count: i64,
        error_count: i64,
    ) -> HistoryEntry {
        let entry = HistoryEntry {
            id: self.next_id,
            timestamp: timestamp.to_string(),
            domains: domains.to_vec(),
            tld_list: tld_list.to_vec(),
            available_count,
            taken_count,
            error_count,
        };
        self.next_id += 1;
        self.entries.push(entry.clone());

        // Prune oldest entries beyond MAX_HISTORY
        while self.entries.len() > MAX_HISTORY {
            self.entries.remove(0);
        }
        entry
    }

    pub fn get_all(&self) -> Vec<HistoryEntry> {
        self.entries.iter().rev().cloned().collect()
    }

    pub fn delete(&mut self, id: i64) {
        self.entries.retain(|e| e.id != id);
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_and_get() {
        let mut store = HistoryStore::new();
        store.add("2026-01-01T00:00:00Z", &["example".into()], &["com".into()], 1, 0, 0);
        store.add("2026-01-02T00:00:00Z", &["test".into()], &["net".into()], 0, 1, 0);
        let entries = store.get_all();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].domains, vec!["test"]); // newest first
    }

    #[test]
    fn delete_entry() {
        let mut store = HistoryStore::new();
        let e = store.add("2026-01-01T00:00:00Z", &["a".into()], &["com".into()], 1, 0, 0);
        store.delete(e.id);
        assert!(store.get_all().is_empty());
    }

    #[test]
    fn clear_all() {
        let mut store = HistoryStore::new();
        for _ in 0..5 { store.add("t", &["x".into()], &["io".into()], 0, 1, 0); }
        store.clear();
        assert!(store.get_all().is_empty());
    }

    #[test]
    fn enforces_max_100() {
        let mut store = HistoryStore::new();
        for _ in 0..105 { store.add("t", &["x".into()], &["com".into()], 0, 0, 1); }
        assert!(store.get_all().len() <= 100);
    }
}
