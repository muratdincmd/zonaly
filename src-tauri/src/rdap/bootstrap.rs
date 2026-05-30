use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

const IANA_BOOTSTRAP_URL: &str = "https://data.iana.org/rdap/dns.json";
const CACHE_FILE: &str = "rdap_bootstrap_cache.json";
const CACHE_TTL_SECS: u64 = 24 * 60 * 60; // 24 hours

#[derive(Debug, Deserialize)]
struct Bootstrap {
    services: Vec<(Vec<String>, Vec<String>)>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DiskCache {
    timestamp_secs: u64,
    map: HashMap<String, String>,
}

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

fn is_cache_fresh(timestamp_secs: u64) -> bool {
    now_secs().saturating_sub(timestamp_secs) <= CACHE_TTL_SECS
}

fn load_disk_cache(path: &PathBuf) -> Option<DiskCache> {
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

fn save_disk_cache(path: &PathBuf, map: &HashMap<String, String>) {
    let cache = DiskCache { timestamp_secs: now_secs(), map: map.clone() };
    if let Ok(json) = serde_json::to_string(&cache) {
        let _ = std::fs::write(path, json);
    }
}

async fn fetch_network(http: &reqwest::Client) -> Result<HashMap<String, String>, String> {
    let body: Bootstrap = http
        .get(IANA_BOOTSTRAP_URL)
        .send()
        .await
        .map_err(|e| format!("network: {e}"))?
        .error_for_status()
        .map_err(|e| format!("server: {e}"))?
        .json()
        .await
        .map_err(|e| format!("parse: {e}"))?;

    let mut map = HashMap::with_capacity(body.services.len() * 4);
    for (tlds, urls) in body.services {
        let Some(base) = urls.into_iter().next() else { continue };
        let base = if base.ends_with('/') { base } else { format!("{base}/") };
        for tld in tlds {
            map.insert(tld.to_ascii_lowercase(), base.clone());
        }
    }
    Ok(map)
}

/// Load bootstrap with disk caching:
///
/// 1. Fresh cache (< 24 h): use immediately, no network call.
/// 2. Expired cache: re-fetch; on failure, use stale cache with a warning.
/// 3. No cache: fetch from network and persist for next run.
pub async fn fetch_with_cache(
    http: &reqwest::Client,
    cache_dir: Option<&PathBuf>,
) -> Option<HashMap<String, String>> {
    let cache_path = cache_dir.map(|d| d.join(CACHE_FILE));

    if let Some(ref path) = cache_path {
        if let Some(cached) = load_disk_cache(path) {
            if is_cache_fresh(cached.timestamp_secs) {
                return Some(cached.map);
            }
            // Expired — try to refresh; fall back to stale on failure
            match fetch_network(http).await {
                Ok(map) => {
                    save_disk_cache(path, &map);
                    return Some(map);
                }
                Err(e) => {
                    eprintln!("RDAP bootstrap refresh failed, using stale cache: {e}");
                    return Some(cached.map);
                }
            }
        }
    }

    // No on-disk cache — go to network
    match fetch_network(http).await {
        Ok(map) => {
            if let Some(ref path) = cache_path {
                save_disk_cache(path, &map);
            }
            Some(map)
        }
        Err(e) => {
            eprintln!("RDAP bootstrap fetch failed: {e}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_cache_is_not_expired() {
        let ts = now_secs() - 100; // 100 seconds ago
        assert!(is_cache_fresh(ts));
    }

    #[test]
    fn old_cache_is_expired() {
        let ts = now_secs().saturating_sub(CACHE_TTL_SECS + 1);
        assert!(!is_cache_fresh(ts));
    }

    #[test]
    fn cache_at_boundary_is_fresh() {
        let ts = now_secs().saturating_sub(CACHE_TTL_SECS);
        assert!(is_cache_fresh(ts));
    }

    #[test]
    fn cache_ttl_is_24_hours() {
        assert_eq!(CACHE_TTL_SECS, 86_400);
    }

    #[test]
    fn disk_cache_roundtrip() {
        let mut map = HashMap::new();
        map.insert("com".to_string(), "https://rdap.verisign.com/com/v1/".to_string());
        map.insert("net".to_string(), "https://rdap.verisign.com/net/v1/".to_string());
        let cache = DiskCache { timestamp_secs: 1_000_000, map: map.clone() };
        let json = serde_json::to_string(&cache).unwrap();
        let roundtripped: DiskCache = serde_json::from_str(&json).unwrap();
        assert_eq!(roundtripped.timestamp_secs, 1_000_000);
        assert_eq!(roundtripped.map["com"], map["com"]);
    }
}
