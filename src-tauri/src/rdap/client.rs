use crate::types::DomainStatus;

pub async fn query(http: &reqwest::Client, base_url: &str, fqdn: &str) -> DomainStatus {
    let url = format!("{base_url}domain/{fqdn}");
    let resp = match http
        .get(&url)
        .header("Accept", "application/rdap+json")
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) if e.is_timeout() => {
            return DomainStatus::Error {
                message: "Request timed out".into(),
            };
        }
        Err(e) => {
            return DomainStatus::Error {
                message: format!("Network error: {e}"),
            };
        }
    };

    match resp.status().as_u16() {
        200 => DomainStatus::Taken,
        404 => DomainStatus::Available,
        429 => DomainStatus::Error {
            message: "Rate limited by RDAP server".into(),
        },
        code => DomainStatus::Error {
            message: format!("Unexpected HTTP {code}"),
        },
    }
}
