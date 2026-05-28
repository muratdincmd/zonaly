use std::collections::HashMap;

use serde::Deserialize;

const IANA_BOOTSTRAP_URL: &str = "https://data.iana.org/rdap/dns.json";

#[derive(Debug, Deserialize)]
struct Bootstrap {
    services: Vec<(Vec<String>, Vec<String>)>,
}

pub async fn fetch(http: &reqwest::Client) -> reqwest::Result<HashMap<String, String>> {
    let body: Bootstrap = http
        .get(IANA_BOOTSTRAP_URL)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let mut map = HashMap::with_capacity(body.services.len() * 2);
    for (tlds, urls) in body.services {
        let Some(base) = urls.into_iter().next() else {
            continue;
        };
        let base = if base.ends_with('/') {
            base
        } else {
            format!("{base}/")
        };
        for tld in tlds {
            map.insert(tld.to_ascii_lowercase(), base.clone());
        }
    }
    Ok(map)
}
