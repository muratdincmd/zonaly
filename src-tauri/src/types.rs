use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainQuery {
    pub name: String,
    pub tld: String,
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
}
