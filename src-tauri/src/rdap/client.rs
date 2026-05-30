use std::time::Duration;

use tokio::time::sleep;

use crate::types::DomainStatus;

/// Number of retry attempts after the initial request (total = MAX_RETRIES + 1).
const MAX_RETRIES: usize = 2;

/// Delay before the Nth retry (0-indexed). Length must equal MAX_RETRIES.
const RETRY_DELAYS_MS: [u64; 2] = [500, 1_500];

/// Extra delay before retrying a 429 rate-limited response.
const RATE_LIMIT_DELAY_MS: u64 = 3_000;

/// How a given HTTP status should be treated by the retry logic.
#[derive(Debug, PartialEq)]
pub enum HttpOutcome {
    /// Domain is registered (HTTP 200).
    Taken,
    /// Domain is available (HTTP 404).
    Available,
    /// Server is rate-limiting us (HTTP 429) — retriable with longer backoff.
    RateLimited,
    /// Transient server error (HTTP 5xx) — retriable.
    ServerError(u16),
    /// Any other status — not retried, returned as-is.
    OtherError(u16),
}

pub fn classify_http(code: u16) -> HttpOutcome {
    match code {
        200 => HttpOutcome::Taken,
        404 => HttpOutcome::Available,
        429 => HttpOutcome::RateLimited,
        c @ 500..=599 => HttpOutcome::ServerError(c),
        c => HttpOutcome::OtherError(c),
    }
}

#[cfg(test)]
pub fn is_retriable(outcome: &HttpOutcome) -> bool {
    matches!(outcome, HttpOutcome::RateLimited | HttpOutcome::ServerError(_))
}

pub async fn query(http: &reqwest::Client, base_url: &str, fqdn: &str) -> DomainStatus {
    let url = format!("{base_url}domain/{fqdn}");

    for (attempt, &retry_delay_ms) in RETRY_DELAYS_MS
        .iter()
        .chain(std::iter::once(&0u64)) // sentinel for the final attempt
        .enumerate()
        .take(MAX_RETRIES + 1)
    {
        let is_last = attempt == MAX_RETRIES;

        let resp = match http
            .get(&url)
            .header("Accept", "application/rdap+json")
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) if e.is_timeout() => {
                if is_last {
                    return DomainStatus::Error { message: "err:timeout".into() };
                }
                sleep(Duration::from_millis(retry_delay_ms)).await;
                continue;
            }
            Err(e) => {
                if is_last {
                    return DomainStatus::Error { message: format!("err:network|{e}") };
                }
                sleep(Duration::from_millis(retry_delay_ms)).await;
                continue;
            }
        };

        match classify_http(resp.status().as_u16()) {
            HttpOutcome::Taken => return DomainStatus::Taken,
            HttpOutcome::Available => return DomainStatus::Available,
            HttpOutcome::RateLimited => {
                if is_last {
                    return DomainStatus::Error { message: "err:rate_limited".into() };
                }
                sleep(Duration::from_millis(RATE_LIMIT_DELAY_MS)).await;
                continue;
            }
            HttpOutcome::ServerError(c) => {
                if is_last {
                    return DomainStatus::Error { message: format!("err:http|{c}") };
                }
                sleep(Duration::from_millis(retry_delay_ms)).await;
                continue;
            }
            HttpOutcome::OtherError(c) => {
                return DomainStatus::Error { message: format!("err:http|{c}") };
            }
        }
    }

    // Unreachable: the loop always returns before exhausting retries,
    // but the compiler needs a value here.
    DomainStatus::Error { message: "err:network|exhausted".into() }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── HTTP classification ────────────────────────────────────────────────────

    #[test]
    fn classify_200_is_taken() {
        assert_eq!(classify_http(200), HttpOutcome::Taken);
    }

    #[test]
    fn classify_404_is_available() {
        assert_eq!(classify_http(404), HttpOutcome::Available);
    }

    #[test]
    fn classify_429_is_rate_limited() {
        assert_eq!(classify_http(429), HttpOutcome::RateLimited);
    }

    #[test]
    fn classify_500_is_server_error() {
        assert_eq!(classify_http(500), HttpOutcome::ServerError(500));
    }

    #[test]
    fn classify_503_is_server_error() {
        assert_eq!(classify_http(503), HttpOutcome::ServerError(503));
    }

    #[test]
    fn classify_400_is_other_error() {
        assert_eq!(classify_http(400), HttpOutcome::OtherError(400));
    }

    #[test]
    fn classify_301_is_other_error() {
        assert_eq!(classify_http(301), HttpOutcome::OtherError(301));
    }

    // ── Retry decisions ────────────────────────────────────────────────────────

    #[test]
    fn rate_limited_is_retriable() {
        assert!(is_retriable(&HttpOutcome::RateLimited));
    }

    #[test]
    fn server_error_is_retriable() {
        assert!(is_retriable(&HttpOutcome::ServerError(503)));
    }

    #[test]
    fn taken_is_not_retriable() {
        assert!(!is_retriable(&HttpOutcome::Taken));
    }

    #[test]
    fn available_is_not_retriable() {
        assert!(!is_retriable(&HttpOutcome::Available));
    }

    #[test]
    fn other_error_is_not_retriable() {
        assert!(!is_retriable(&HttpOutcome::OtherError(400)));
    }

    // ── Backoff configuration ─────────────────────────────────────────────────

    #[test]
    fn retry_delays_are_increasing() {
        for i in 1..RETRY_DELAYS_MS.len() {
            assert!(
                RETRY_DELAYS_MS[i] > RETRY_DELAYS_MS[i - 1],
                "retry delay at index {i} should be larger than index {}",
                i - 1
            );
        }
    }

    #[test]
    fn rate_limit_delay_exceeds_normal_backoff() {
        let max_normal = *RETRY_DELAYS_MS.iter().max().unwrap();
        assert!(RATE_LIMIT_DELAY_MS > max_normal);
    }

    #[test]
    fn retry_delays_length_matches_max_retries() {
        assert_eq!(RETRY_DELAYS_MS.len(), MAX_RETRIES);
    }

    #[test]
    fn max_retries_is_in_reasonable_range() {
        assert!(MAX_RETRIES >= 1 && MAX_RETRIES <= 5);
    }
}
