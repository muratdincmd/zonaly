use serde::{Deserialize, Serialize};

/// A single result to be exported.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub name: String,
    pub tld: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainQuery {
    pub name: String,
    pub tld: String,
}

/// Which protocol produced a given availability check.
/// Detail fetches are only fully supported for `Rdap` results.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Rdap,
    Whois,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum DomainStatus {
    Available,
    Taken,
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainResult {
    pub name: String,
    pub tld: String,
    pub status: DomainStatus,
    /// `None` when status is `Error` and the protocol couldn't be determined.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<Source>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainDetails {
    pub name: String,
    pub tld: String,
    pub source: Source,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registrar: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registered: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<String>,
    pub nameservers: Vec<String>,
    pub statuses: Vec<String>,
}

/// Emitted to the frontend each time a watchlist alert is inserted, so the
/// UI can fire a translated native OS notification immediately.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistAlertEvent {
    pub alert_type: String,
    pub domain: String,
    pub tld: String,
}

/// Snapshot of the on-disk RDAP bootstrap cache's state, for the Settings UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheInfo {
    pub exists: bool,
    pub size_bytes: u64,
    pub age_secs: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn watchlist_alert_event_serializes_camel_case() {
        let e = WatchlistAlertEvent {
            alert_type: "status_change".into(),
            domain: "example".into(),
            tld: "com".into(),
        };
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["alertType"], "status_change");
        assert_eq!(json["domain"], "example");
        assert_eq!(json["tld"], "com");
    }
}
