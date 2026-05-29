//! Port-43 WHOIS fallback for ccTLDs without RDAP coverage.
//!
//! Each registry's plain-text format is slightly different, so we keep a small
//! per-TLD parser. For TLDs we don't have a hand-rolled parser for we still
//! return raw availability based on generic "no match" markers.

use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

use crate::types::DomainStatus;

const PORT: u16 = 43;
const QUERY_TIMEOUT_SECS: u64 = 8;
const MAX_RESPONSE_BYTES: usize = 64 * 1024;

/// Returns the WHOIS server hostname for a TLD we explicitly support.
/// Add new TLDs here as we hand-write parsers for them.
pub fn server_for(tld: &str) -> Option<&'static str> {
    match tld.to_ascii_lowercase().as_str() {
        "de" => Some("whois.denic.de"),
        "tr" => Some("whois.nic.tr"),
        _ => None,
    }
}

/// Send a WHOIS query and read the raw response (UTF-8 lossy decoded).
async fn query_raw(server: &str, fqdn: &str) -> Result<String, String> {
    let addr = format!("{server}:{PORT}");
    let mut stream = timeout(
        Duration::from_secs(QUERY_TIMEOUT_SECS),
        TcpStream::connect(&addr),
    )
    .await
    .map_err(|_| format!("WHOIS connect timeout to {server}"))?
    .map_err(|e| format!("WHOIS connect failed: {e}"))?;

    let query = format!("{fqdn}\r\n");
    timeout(
        Duration::from_secs(QUERY_TIMEOUT_SECS),
        stream.write_all(query.as_bytes()),
    )
    .await
    .map_err(|_| "WHOIS write timeout".to_string())?
    .map_err(|e| format!("WHOIS write failed: {e}"))?;

    let mut buf = Vec::with_capacity(4096);
    let mut chunk = [0u8; 4096];
    loop {
        let n = timeout(
            Duration::from_secs(QUERY_TIMEOUT_SECS),
            stream.read(&mut chunk),
        )
        .await
        .map_err(|_| "WHOIS read timeout".to_string())?
        .map_err(|e| format!("WHOIS read failed: {e}"))?;
        if n == 0 {
            break;
        }
        if buf.len() + n > MAX_RESPONSE_BYTES {
            buf.extend_from_slice(&chunk[..MAX_RESPONSE_BYTES - buf.len()]);
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
    }

    Ok(String::from_utf8_lossy(&buf).into_owned())
}

/// Check availability via port-43 WHOIS. Returns Some(status) if the TLD is
/// supported, None if no WHOIS server is configured for this TLD.
pub async fn check(tld: &str, fqdn: &str) -> Option<DomainStatus> {
    let server = server_for(tld)?;
    let status = match query_raw(server, fqdn).await {
        Ok(body) => parse_availability(tld, &body),
        Err(e) => DomainStatus::Error { message: e },
    };
    Some(status)
}

/// Per-TLD availability heuristics. When in doubt we fall back to the generic
/// "no match" patterns shared across most registries.
fn parse_availability(tld: &str, body: &str) -> DomainStatus {
    let lower = body.to_ascii_lowercase();

    match tld.to_ascii_lowercase().as_str() {
        // DENIC: "Status: free" = available, "Status: connect/failed" = taken
        "de" => {
            if lower.contains("status: free") {
                DomainStatus::Available
            } else if lower.contains("status: connect") || lower.contains("status: failed") {
                DomainStatus::Taken
            } else if is_generic_unavailable(&lower) {
                DomainStatus::Available
            } else {
                DomainStatus::Taken
            }
        }
        // NIC.tr: "No match found" = available; otherwise structured data = taken
        "tr" => {
            if is_generic_unavailable(&lower) {
                DomainStatus::Available
            } else if lower.contains("** domain") || lower.contains("domain name:") {
                DomainStatus::Taken
            } else {
                DomainStatus::Error {
                    message: "Unrecognized .tr WHOIS response".into(),
                }
            }
        }
        _ => {
            if is_generic_unavailable(&lower) {
                DomainStatus::Available
            } else {
                DomainStatus::Taken
            }
        }
    }
}

/// Common phrases registries use to indicate a domain isn't registered.
fn is_generic_unavailable(lower_body: &str) -> bool {
    const MARKERS: &[&str] = &[
        "no match",
        "not found",
        "no entries found",
        "no data found",
        "is available",
        "domain not found",
        "no object found",
        "available for purchase",
        "no match for",
    ];
    MARKERS.iter().any(|m| lower_body.contains(m))
}
