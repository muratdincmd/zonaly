mod bootstrap;
mod client;
mod details;
mod whois;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::{watch, Mutex, Semaphore};

use crate::types::{CacheInfo, DomainDetails, DomainQuery, DomainResult, DomainStatus, Source};

const MAX_CONCURRENCY: usize = 10;
const REQUEST_TIMEOUT_SECS: u64 = 8;

/// Shared watch-channel sender keyed by FQDN.
/// First caller owns the sender; subsequent callers subscribe to the receiver
/// and wait for the first caller to broadcast its result.
type InflightEntry = Arc<watch::Sender<Option<DomainResult>>>;

pub struct RdapClient {
    http: reqwest::Client,
    /// In-memory bootstrap cache (populated on first use).
    bootstrap: Mutex<Option<HashMap<String, String>>>,
    /// Semaphore bounding concurrent outbound requests. Held behind a
    /// std Mutex so it can be swapped wholesale when the user changes the
    /// max-concurrency setting; Tokio's Semaphore has no atomic resize API.
    semaphore: std::sync::Mutex<Arc<Semaphore>>,
    /// On-disk cache directory for RDAP bootstrap JSON.
    cache_dir: Option<PathBuf>,
    /// In-flight deduplication: FQDN → watch sender.
    inflight: Mutex<HashMap<String, InflightEntry>>,
}

impl RdapClient {
    pub fn new(cache_dir: Option<PathBuf>) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .user_agent(concat!("zonaly/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("failed to build reqwest client");
        Self {
            http,
            bootstrap: Mutex::new(None),
            semaphore: std::sync::Mutex::new(Arc::new(Semaphore::new(MAX_CONCURRENCY))),
            cache_dir,
            inflight: Mutex::new(HashMap::new()),
        }
    }

    /// Current semaphore handle. Callers should clone this once per batch/
    /// request at spawn time; a later `set_max_concurrency` call swaps in a
    /// fresh semaphore without affecting handles already cloned out.
    pub fn current_semaphore(&self) -> Arc<Semaphore> {
        self.semaphore.lock().expect("semaphore mutex poisoned").clone()
    }

    /// Replace the semaphore with a new one bounding `n` concurrent requests
    /// (clamped to 1..=30). Already-running batches keep using the semaphore
    /// they cloned at spawn time, so this never disrupts in-flight work.
    pub fn set_max_concurrency(&self, n: usize) {
        let n = n.clamp(1, 30);
        let mut guard = self.semaphore.lock().expect("semaphore mutex poisoned");
        *guard = Arc::new(Semaphore::new(n));
    }

    fn cache_file_path(&self) -> Option<PathBuf> {
        self.cache_dir.as_ref().map(|d| d.join("rdap_bootstrap_cache.json"))
    }

    /// Clear both the in-memory bootstrap cache and the on-disk cache file.
    /// Clearing only the disk file would leave the in-memory map serving
    /// stale data until the app restarts.
    pub async fn clear_bootstrap_cache(&self) -> Result<(), String> {
        *self.bootstrap.lock().await = None;
        if let Some(path) = self.cache_file_path() {
            if path.exists() {
                std::fs::remove_file(&path).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    /// Report the on-disk bootstrap cache's size and age, for the Settings UI.
    pub fn cache_info(&self) -> CacheInfo {
        let Some(path) = self.cache_file_path() else {
            return CacheInfo { exists: false, size_bytes: 0, age_secs: 0 };
        };
        match std::fs::metadata(&path) {
            Ok(meta) => {
                let age_secs = bootstrap::cached_timestamp(&path)
                    .map(|ts| bootstrap::now_secs().saturating_sub(ts))
                    .unwrap_or(0);
                CacheInfo { exists: true, size_bytes: meta.len(), age_secs }
            }
            Err(_) => CacheInfo { exists: false, size_bytes: 0, age_secs: 0 },
        }
    }

    async fn base_url_for(&self, tld: &str) -> Option<String> {
        let mut guard = self.bootstrap.lock().await;
        if guard.is_none() {
            *guard = bootstrap::fetch_with_cache(&self.http, self.cache_dir.as_ref()).await;
        }
        guard
            .as_ref()
            .and_then(|m| m.get(&tld.to_ascii_lowercase()).cloned())
    }

    /// Check domain availability, with in-flight deduplication.
    ///
    /// If the same FQDN is already being checked, this call subscribes to the
    /// ongoing request's result instead of sending a duplicate query.
    pub async fn check(&self, query: &DomainQuery) -> DomainResult {
        let fqdn = format!("{}.{}", query.name, query.tld);

        // ── Deduplication ────────────────────────────────────────────────────
        let dedup_rx = {
            let mut inflight = self.inflight.lock().await;
            if let Some(tx) = inflight.get(&fqdn) {
                // Another task is already checking this FQDN — subscribe.
                Some(tx.subscribe())
            } else {
                // We're first — claim this slot.
                let (tx, _) = watch::channel::<Option<DomainResult>>(None);
                inflight.insert(fqdn.clone(), Arc::new(tx));
                None
            }
        };

        if let Some(mut rx) = dedup_rx {
            // Wait for the in-flight request to finish.
            return match rx.changed().await {
                Ok(()) => rx.borrow().clone().unwrap_or_else(|| self.error_result(query, "err:network|dedup_failed")),
                Err(_) => {
                    // Sender was dropped (task cancelled) — clean up stale entry.
                    self.inflight.lock().await.remove(&fqdn);
                    self.error_result(query, "err:timeout")
                }
            };
        }

        // ── Perform the actual check ─────────────────────────────────────────
        let result = self.do_check(query, &fqdn).await;

        // Broadcast result to any waiting subscribers, then remove slot.
        {
            let mut inflight = self.inflight.lock().await;
            if let Some(tx) = inflight.remove(&fqdn) {
                let _ = tx.send(Some(result.clone()));
            }
        }

        result
    }

    async fn do_check(&self, query: &DomainQuery, fqdn: &str) -> DomainResult {
        // 1. Try RDAP first.
        if let Some(base) = self.base_url_for(&query.tld).await {
            let status = client::query(&self.http, &base, fqdn).await;
            return DomainResult {
                name: query.name.clone(),
                tld: query.tld.clone(),
                status,
                source: Some(Source::Rdap),
            };
        }

        // 2. Fall back to port-43 WHOIS.
        if let Some(status) = whois::check(&query.tld, fqdn).await {
            return DomainResult {
                name: query.name.clone(),
                tld: query.tld.clone(),
                status,
                source: Some(Source::Whois),
            };
        }

        // 3. Neither protocol available.
        DomainResult {
            name: query.name.clone(),
            tld: query.tld.clone(),
            status: DomainStatus::Error {
                message: format!("err:no_protocol|.{}", query.tld),
            },
            source: None,
        }
    }

    /// Convenience: build an error DomainResult for a query.
    fn error_result(&self, query: &DomainQuery, msg: &str) -> DomainResult {
        DomainResult {
            name: query.name.clone(),
            tld: query.tld.clone(),
            status: DomainStatus::Error { message: msg.into() },
            source: None,
        }
    }

    /// Fetch full RDAP detail for a Taken domain.
    pub async fn fetch_details(&self, name: &str, tld: &str) -> Result<DomainDetails, String> {
        if let Some(base) = self.base_url_for(tld).await {
            return details::fetch(&self.http, &base, name, tld).await;
        }
        if whois::server_for(tld).is_some() {
            return Ok(DomainDetails {
                name: name.to_string(),
                tld: tld.to_string(),
                source: Source::Whois,
                registrar: None,
                registered: None,
                expires: None,
                updated: None,
                nameservers: Vec::new(),
                statuses: Vec::new(),
            });
        }
        Err(format!("No RDAP or WHOIS server known for .{tld}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_max_concurrency_swaps_without_mutating_old_handle() {
        let client = RdapClient::new(None);
        let old = client.current_semaphore();
        assert_eq!(old.available_permits(), MAX_CONCURRENCY);

        client.set_max_concurrency(3);
        let new = client.current_semaphore();
        assert_eq!(new.available_permits(), 3);

        // The handle captured before the resize is untouched — proves the
        // swap-not-mutate guarantee that keeps in-flight batches unaffected.
        assert_eq!(old.available_permits(), MAX_CONCURRENCY);
        assert!(!Arc::ptr_eq(&old, &new));
    }

    #[test]
    fn set_max_concurrency_clamps_to_valid_range() {
        let client = RdapClient::new(None);

        client.set_max_concurrency(0);
        assert_eq!(client.current_semaphore().available_permits(), 1);

        client.set_max_concurrency(999);
        assert_eq!(client.current_semaphore().available_permits(), 30);
    }

    #[tokio::test]
    async fn clear_bootstrap_cache_clears_memory_and_disk() {
        let dir = std::env::temp_dir().join("zonaly_test_clear_cache");
        std::fs::create_dir_all(&dir).unwrap();
        let client = RdapClient::new(Some(dir.clone()));

        // Seed both the in-memory and on-disk cache.
        *client.bootstrap.lock().await = Some(HashMap::from([
            ("com".to_string(), "https://rdap.example/".to_string()),
        ]));
        let cache_path = client.cache_file_path().unwrap();
        std::fs::write(&cache_path, r#"{"timestamp_secs":1,"map":{}}"#).unwrap();
        assert!(cache_path.exists());

        client.clear_bootstrap_cache().await.unwrap();

        assert!(client.bootstrap.lock().await.is_none());
        assert!(!cache_path.exists());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn cache_info_reports_missing_cache() {
        let dir = std::env::temp_dir().join("zonaly_test_cache_info_missing");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let client = RdapClient::new(Some(dir.clone()));

        let info = client.cache_info();
        assert!(!info.exists);
        assert_eq!(info.size_bytes, 0);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn cache_info_reports_existing_cache() {
        let dir = std::env::temp_dir().join("zonaly_test_cache_info_existing");
        std::fs::create_dir_all(&dir).unwrap();
        let client = RdapClient::new(Some(dir.clone()));
        let cache_path = client.cache_file_path().unwrap();
        std::fs::write(&cache_path, r#"{"timestamp_secs":1,"map":{}}"#).unwrap();

        let info = client.cache_info();
        assert!(info.exists);
        assert!(info.size_bytes > 0);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
