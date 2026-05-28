mod bootstrap;
mod client;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, Semaphore};

use crate::types::{DomainQuery, DomainResult, DomainStatus};

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
        let status = match self.base_url_for(&query.tld).await {
            Some(base) => {
                let fqdn = format!("{}.{}", query.name, query.tld);
                client::query(&self.http, &base, &fqdn).await
            }
            None => DomainStatus::Error {
                message: format!("RDAP unavailable for .{}", query.tld),
            },
        };
        DomainResult {
            name: query.name.clone(),
            tld: query.tld.clone(),
            status,
        }
    }
}
