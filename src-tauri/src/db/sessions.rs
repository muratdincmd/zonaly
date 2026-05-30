use serde::{Deserialize, Serialize};

const MAX_SESSIONS: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedSession {
    pub id: i64,
    pub name: String,
    pub domains: Vec<String>,
    pub tld_list: Vec<String>,
    pub created_at: String,
}

/// In-memory sessions store (not persisted between restarts).
pub struct SessionStore {
    entries: Vec<SavedSession>,
    next_id: i64,
}

impl SessionStore {
    pub fn new() -> Self {
        Self { entries: Vec::new(), next_id: 1 }
    }

    pub fn save(
        &mut self,
        name: &str,
        domains: &[String],
        tld_list: &[String],
        created_at: &str,
    ) -> SavedSession {
        let session = SavedSession {
            id: self.next_id,
            name: name.to_string(),
            domains: domains.to_vec(),
            tld_list: tld_list.to_vec(),
            created_at: created_at.to_string(),
        };
        self.next_id += 1;
        self.entries.push(session.clone());
        while self.entries.len() > MAX_SESSIONS {
            self.entries.remove(0);
        }
        session
    }

    pub fn get_all(&self) -> Vec<SavedSession> {
        self.entries.iter().rev().cloned().collect()
    }

    pub fn delete(&mut self, id: i64) {
        self.entries.retain(|e| e.id != id);
    }

    pub fn rename(&mut self, id: i64, name: &str) {
        if let Some(e) = self.entries.iter_mut().find(|e| e.id == id) {
            e.name = name.to_string();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_and_get() {
        let mut store = SessionStore::new();
        let s = store.save("My Session", &["example".into()], &["com".into()], "2026-01-01T00:00:00Z");
        assert_eq!(s.name, "My Session");
        assert_eq!(store.get_all().len(), 1);
    }

    #[test]
    fn delete_session() {
        let mut store = SessionStore::new();
        let s = store.save("Del", &["x".into()], &["net".into()], "2026-01-01T00:00:00Z");
        store.delete(s.id);
        assert!(store.get_all().is_empty());
    }

    #[test]
    fn rename_session() {
        let mut store = SessionStore::new();
        let s = store.save("Old", &["x".into()], &["io".into()], "2026-01-01T00:00:00Z");
        store.rename(s.id, "New");
        assert_eq!(store.get_all()[0].name, "New");
    }

    #[test]
    fn enforces_max_50() {
        let mut store = SessionStore::new();
        for i in 0..55usize { store.save(&format!("s{i}"), &["x".into()], &["com".into()], "t"); }
        assert!(store.get_all().len() <= 50);
    }
}
