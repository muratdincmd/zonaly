mod bootstrap;
mod client;
mod details;
mod whois;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, Semaphore};

use crate::types::{DomainDetails, DomainQuery, DomainResult, DomainStatus, Source};

const MAX_CONCURRENCY: usize = 10;
const HTTP_TIMEOUT_SECS: u64 = 10;

pub struct RdapClient {
    http: reqwest::Client,
    bootstrap: Mutex<Option<HashMap<String, String>>>,
    pub semaphore: Arc<Semaphore>,
}

impl RdapClient {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .user_agent(concat!("zonaly/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("failed to build reqwest client");
        Self {
            http,
            bootstrap: Mutex::new(None),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENCY)),
        }
    }

    async fn base_url_for(&self, tld: &str) -> Option<String> {
        let mut guard = self.bootstrap.lock().await;
        if guard.is_none() {
            match bootstrap::fetch(&self.http).await {
                Ok(map) => *guard = Some(map),
                Err(e) => {
                    eprintln!("RDAP bootstrap fetch failed: {e}");
                    return None;
                }
            }
        }
        guard
            .as_ref()
            .and_then(|m| m.get(&tld.to_ascii_lowercase()).cloned())
    }

    pub async fn check(&self, query: &DomainQuery) -> DomainResult {
        let fqdn = format!("{}.{}", query.name, query.tld);

        // 1. Try RDAP first
        if let Some(base) = self.base_url_for(&query.tld).await {
            let status = client::query(&self.http, &base, &fqdn).await;
            return DomainResult {
                name: query.name.clone(),
                tld: query.tld.clone(),
                status,
                source: Some(Source::Rdap),
            };
        }

        // 2. Fall back to port-43 WHOIS for TLDs we explicitly support
        if let Some(status) = whois::check(&query.tld, &fqdn).await {
            return DomainResult {
                name: query.name.clone(),
                tld: query.tld.clone(),
                status,
                source: Some(Source::Whois),
            };
        }

        // 3. Neither protocol available
        DomainResult {
            name: query.name.clone(),
            tld: query.tld.clone(),
            status: DomainStatus::Error {
                message: format!("err:no_protocol|.{}", query.tld),
            },
            source: None,
        }
    }

    /// Fetch full domain details for a previously-checked domain.
    /// Only RDAP-source domains return rich data; WHOIS-source TLDs return
    /// a minimal record (details modal handles this gracefully).
    pub async fn fetch_details(
        &self,
        name: &str,
        tld: &str,
    ) -> Result<DomainDetails, String> {
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
