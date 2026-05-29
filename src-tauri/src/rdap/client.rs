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
                message: "err:timeout".into(),
            };
        }
        Err(e) => {
            return DomainStatus::Error {
                message: format!("err:network|{e}"),
            };
        }
    };

    match resp.status().as_u16() {
        200 => DomainStatus::Taken,
        404 => DomainStatus::Available,
        429 => DomainStatus::Error {
            message: "err:rate_limited".into(),
        },
        code => DomainStatus::Error {
            message: format!("err:http|{code}"),
        },
    }
}

#[cfg(test)]
fn status_from_http_code(code: u16) -> DomainStatus {
    match code {
        200 => DomainStatus::Taken,
        404 => DomainStatus::Available,
        429 => DomainStatus::Error { message: "err:rate_limited".into() },
        c   => DomainStatus::Error { message: format!("err:http|{c}") },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn http_200_is_taken() {
        assert!(matches!(status_from_http_code(200), DomainStatus::Taken));
    }

    #[test]
    fn http_404_is_available() {
        assert!(matches!(status_from_http_code(404), DomainStatus::Available));
    }

    #[test]
    fn http_429_is_rate_limited_error() {
        match status_from_http_code(429) {
            DomainStatus::Error { message } => assert_eq!(message, "err:rate_limited"),
            other => panic!("expected Error, got {other:?}"),
        }
    }

    #[test]
    fn http_500_is_generic_error_with_code() {
        match status_from_http_code(500) {
            DomainStatus::Error { message } => assert!(message.contains("500")),
            other => panic!("expected Error, got {other:?}"),
        }
    }

    #[test]
    fn http_503_error_message_has_err_prefix() {
        match status_from_http_code(503) {
            DomainStatus::Error { message } => assert!(message.starts_with("err:http|")),
            other => panic!("expected Error, got {other:?}"),
        }
    }
}
