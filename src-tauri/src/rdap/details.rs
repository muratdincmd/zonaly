//! Parse a RDAP domain response into a flat `DomainDetails` for the UI.
//!
//! The RDAP schema (RFC 9083) is broad. We extract only what the detail modal
//! needs: registrar name, registration/expiry/last-changed dates, nameservers,
//! and status codes.

use serde_json::Value;

use crate::types::{DomainDetails, Source};

pub async fn fetch(
    http: &reqwest::Client,
    base_url: &str,
    name: &str,
    tld: &str,
) -> Result<DomainDetails, String> {
    let fqdn = format!("{name}.{tld}");
    let url = format!("{base_url}domain/{fqdn}");

    let resp = http
        .get(&url)
        .header("Accept", "application/rdap+json")
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("RDAP server returned HTTP {}", status.as_u16()));
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Invalid RDAP JSON: {e}"))?;

    Ok(parse(&body, name, tld))
}

fn parse(body: &Value, name: &str, tld: &str) -> DomainDetails {
    DomainDetails {
        name: name.to_string(),
        tld: tld.to_string(),
        source: Source::Rdap,
        registrar: extract_registrar(body),
        registered: extract_event(body, "registration"),
        expires: extract_event(body, "expiration"),
        updated: extract_event(body, "last changed"),
        nameservers: extract_nameservers(body),
        statuses: extract_statuses(body),
    }
}

/// Status codes — RDAP returns an array of EPP-style strings under `status`.
fn extract_statuses(body: &Value) -> Vec<String> {
    body.get("status")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

/// Nameservers under `nameservers[].ldhName`.
fn extract_nameservers(body: &Value) -> Vec<String> {
    body.get("nameservers")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(|ns| {
                    ns.get("ldhName")
                        .and_then(Value::as_str)
                        .map(|s| s.to_ascii_lowercase())
                })
                .collect()
        })
        .unwrap_or_default()
}

/// `events[].eventAction` matches one of "registration", "expiration",
/// "last changed", "last update of RDAP database", etc.
fn extract_event(body: &Value, action: &str) -> Option<String> {
    let events = body.get("events")?.as_array()?;
    events.iter().find_map(|ev| {
        let ev_action = ev.get("eventAction")?.as_str()?;
        if ev_action.eq_ignore_ascii_case(action) {
            ev.get("eventDate")?.as_str().map(str::to_string)
        } else {
            None
        }
    })
}

/// Registrar comes from the entity whose `roles` contains "registrar".
/// Name lives inside the vCard array — a deeply nested jCard structure.
fn extract_registrar(body: &Value) -> Option<String> {
    let entities = body.get("entities")?.as_array()?;
    for entity in entities {
        let roles = entity.get("roles").and_then(Value::as_array);
        let is_registrar = roles
            .map(|r| {
                r.iter()
                    .any(|v| v.as_str().is_some_and(|s| s.eq_ignore_ascii_case("registrar")))
            })
            .unwrap_or(false);
        if !is_registrar {
            continue;
        }

        // Try vCard "fn" property first
        if let Some(name) = vcard_field(entity, "fn") {
            return Some(name);
        }
        // Fallback to the entity's handle/publicIds
        if let Some(handle) = entity.get("handle").and_then(Value::as_str) {
            return Some(handle.to_string());
        }
    }
    None
}

/// Extract a top-level vCard field by name. vCardArray shape:
/// `["vcard", [["version",{},"text","4.0"], ["fn",{},"text","Registrar Name"]]]`
fn vcard_field(entity: &Value, field: &str) -> Option<String> {
    let arr = entity.get("vcardArray")?.as_array()?;
    let props = arr.get(1)?.as_array()?;
    for prop in props {
        let prop_arr = prop.as_array()?;
        let key = prop_arr.first()?.as_str()?;
        if key.eq_ignore_ascii_case(field) {
            // value is the 4th element (index 3); skip type/parameters
            return prop_arr.get(3).and_then(Value::as_str).map(str::to_string);
        }
    }
    None
}
