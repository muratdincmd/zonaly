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
    .map_err(|_| "err:timeout".to_string())?
    .map_err(|e| format!("err:network|{e}"))?;

    let query = format!("{fqdn}\r\n");
    timeout(
        Duration::from_secs(QUERY_TIMEOUT_SECS),
        stream.write_all(query.as_bytes()),
    )
    .await
    .map_err(|_| "err:timeout".to_string())?
    .map_err(|e| format!("err:network|{e}"))?;

    let mut buf = Vec::with_capacity(4096);
    let mut chunk = [0u8; 4096];
    loop {
        let n = timeout(
            Duration::from_secs(QUERY_TIMEOUT_SECS),
            stream.read(&mut chunk),
        )
        .await
        .map_err(|_| "err:timeout".to_string())?
        .map_err(|e| format!("err:network|{e}"))?;
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
                    message: "err:parse".into(),
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

#[cfg(test)]
mod tests {
    use super::*;

    // ── server_for ────────────────────────────────────────────────────────────

    #[test]
    fn server_for_de_and_tr() {
        assert!(server_for("de").is_some());
        assert!(server_for("tr").is_some());
    }

    #[test]
    fn server_for_unknown_returns_none() {
        assert!(server_for("io").is_none());
        assert!(server_for("xyz").is_none());
        assert!(server_for("").is_none());
    }

    // ── .de (DENIC) parsing ───────────────────────────────────────────────────

    #[test]
    fn de_free_status_is_available() {
        let body = "% Whois server\nStatus: free\n";
        assert!(matches!(
            parse_availability("de", body),
            DomainStatus::Available
        ));
    }

    #[test]
    fn de_connect_status_is_taken() {
        let body = "Status: connect\nHolder: Some Corp\n";
        assert!(matches!(
            parse_availability("de", body),
            DomainStatus::Taken
        ));
    }

    #[test]
    fn de_failed_status_is_taken() {
        let body = "Status: failed\n";
        assert!(matches!(
            parse_availability("de", body),
            DomainStatus::Taken
        ));
    }

    #[test]
    fn de_no_match_is_available() {
        let body = "% No match for the selected source(s).";
        assert!(matches!(
            parse_availability("de", body),
            DomainStatus::Available
        ));
    }

    #[test]
    fn de_structured_response_is_taken() {
        let body = "Registrar: Some Registrar\nDomain: example.de\n";
        assert!(matches!(
            parse_availability("de", body),
            DomainStatus::Taken
        ));
    }

    // ── .tr (NIC.tr) parsing ──────────────────────────────────────────────────

    #[test]
    fn tr_no_match_found_is_available() {
        let body = "No match found for 'example.tr'.";
        assert!(matches!(
            parse_availability("tr", body),
            DomainStatus::Available
        ));
    }

    #[test]
    fn tr_domain_name_field_is_taken() {
        let body = "** Domain Name: example.tr\n   Registrar: ...\n";
        assert!(matches!(
            parse_availability("tr", body),
            DomainStatus::Taken
        ));
    }

    #[test]
    fn tr_domain_name_keyword_is_taken() {
        let body = "Domain Name: example.tr\n";
        assert!(matches!(
            parse_availability("tr", body),
            DomainStatus::Taken
        ));
    }

    #[test]
    fn tr_unrecognised_body_returns_error() {
        let body = "Some completely unexpected response without any known pattern.";
        assert!(matches!(
            parse_availability("tr", body),
            DomainStatus::Error { .. }
        ));
    }

    // ── generic fallback ──────────────────────────────────────────────────────

    #[test]
    fn generic_not_found_is_available() {
        let body = "Domain not found.";
        assert!(matches!(
            parse_availability("uk", body),
            DomainStatus::Available
        ));
    }

    #[test]
    fn generic_structured_response_is_taken() {
        let body = "Registrant: Some Person\n";
        assert!(matches!(
            parse_availability("uk", body),
            DomainStatus::Taken
        ));
    }

    // ── is_generic_unavailable ────────────────────────────────────────────────

    #[test]
    fn generic_unavailable_markers() {
        let cases = [
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
        for marker in cases {
            assert!(
                is_generic_unavailable(marker),
                "marker '{marker}' should be detected as unavailable"
            );
        }
    }

    #[test]
    fn generic_unavailable_returns_false_for_taken_body() {
        assert!(!is_generic_unavailable("registrar: example registrar\n"));
    }
}
