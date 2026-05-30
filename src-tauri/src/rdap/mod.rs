mod bootstrap;
mod client;
mod details;
mod whois;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::{watch, Mutex, Semaphore};

use crate::types::{DomainDetails, DomainQuery, DomainResult, DomainStatus, Source};

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
    /// Semaphore bounding concurrent outbound requests.
    pub semaphore: Arc<Semaphore>,
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
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENCY)),
            cache_dir,
            inflight: Mutex::new(HashMap::new()),
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
