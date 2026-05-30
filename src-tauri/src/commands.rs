use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;
use tokio::task::JoinSet;

use crate::db::{Database, HistoryEntry, SavedSession, WatchlistEntry};
use crate::rdap::RdapClient;
use crate::types::{DomainDetails, DomainQuery, DomainResult, DomainStatus, ExportResult};

const OVERALL_CHECK_TIMEOUT_SECS: u64 = 30;

// ── Splashscreen ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn close_splashscreen(app: AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 900.0,
            height: 720.0,
        }));
        let _ = main.center();
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
}

// ── Open URL ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Only http/https URLs are allowed".into());
    }
    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd")
        .args(["/c", "start", "", &url])
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Domain details ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fetch_domain_details(
    state: State<'_, Arc<RdapClient>>,
    name: String,
    tld: String,
) -> Result<DomainDetails, String> {
    let client = state.inner().clone();
    let _permit = client.semaphore.clone().acquire_owned().await.ok();
    client.fetch_details(&name, &tld).await
}

// ── Check domains (with history auto-save + 30s timeout) ─────────────────────

#[tauri::command]
pub async fn check_domains(
    app: AppHandle,
    state: State<'_, Arc<RdapClient>>,
    queries: Vec<DomainQuery>,
) -> Result<(), String> {
    let client = state.inner().clone();
    let mut set: JoinSet<()> = JoinSet::new();

    let unique_names: Vec<String> = {
        let mut seen = std::collections::HashSet::new();
        queries.iter().filter(|q| seen.insert(q.name.clone())).map(|q| q.name.clone()).collect()
    };
    let unique_tlds: Vec<String> = {
        let mut seen = std::collections::HashSet::new();
        queries.iter().filter(|q| seen.insert(q.tld.clone())).map(|q| q.tld.clone()).collect()
    };

    let pending: Arc<Mutex<HashMap<String, DomainQuery>>> = Arc::new(Mutex::new(
        queries.iter().map(|q| (format!("{}.{}", q.name, q.tld), q.clone())).collect(),
    ));
    let collected_results: Arc<Mutex<Vec<DomainResult>>> =
        Arc::new(Mutex::new(Vec::with_capacity(queries.len())));

    for query in queries {
        let client = client.clone();
        let app_clone = app.clone();
        let pending = pending.clone();
        let collected = collected_results.clone();

        set.spawn(async move {
            let _permit = client.semaphore.clone().acquire_owned().await.ok();
            let result = client.check(&query).await;
            pending.lock().await.remove(&format!("{}.{}", result.name, result.tld));
            collected.lock().await.push(result.clone());
            if let Err(e) = app_clone.emit("domain-result", &result) {
                eprintln!("emit domain-result failed: {e}");
            }
        });
    }

    let outcome = tokio::time::timeout(
        Duration::from_secs(OVERALL_CHECK_TIMEOUT_SECS),
        async { while set.join_next().await.is_some() {} },
    ).await;

    if outcome.is_err() {
        set.abort_all();
        let remaining = pending.lock().await;
        eprintln!("Overall check timeout: {} queries did not complete", remaining.len());
        for query in remaining.values() {
            let result = DomainResult {
                name: query.name.clone(),
                tld: query.tld.clone(),
                status: DomainStatus::Error { message: "err:timeout".into() },
                source: None,
            };
            collected_results.lock().await.push(result.clone());
            let _ = app.emit("domain-result", &result);
        }
    }

    // Auto-save history entry
    {
        let results = collected_results.lock().await;
        let available = results.iter().filter(|r| matches!(r.status, DomainStatus::Available)).count() as i64;
        let taken    = results.iter().filter(|r| matches!(r.status, DomainStatus::Taken)).count() as i64;
        let errors   = results.iter().filter(|r| matches!(r.status, DomainStatus::Error { .. })).count() as i64;

        if available + taken + errors > 0 {
            if let Some(db) = app.try_state::<Arc<Database>>() {
                db.history.lock().unwrap().add(
                    &chrono_now(), &unique_names, &unique_tlds, available, taken, errors,
                );
            }
        }
    }

    if let Err(e) = app.emit("domain-results-complete", ()) {
        eprintln!("emit complete failed: {e}");
    }
    Ok(())
}

// ── History commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_history(state: State<'_, Arc<Database>>) -> Result<Vec<HistoryEntry>, String> {
    Ok(state.history.lock().unwrap().get_all())
}

#[tauri::command]
pub fn delete_history_entry(state: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    state.history.lock().unwrap().delete(id);
    Ok(())
}

#[tauri::command]
pub fn clear_history(state: State<'_, Arc<Database>>) -> Result<(), String> {
    state.history.lock().unwrap().clear();
    Ok(())
}

// ── Session commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn save_session(
    state: State<'_, Arc<Database>>,
    name: String,
    domains: Vec<String>,
    tlds: Vec<String>,
) -> Result<SavedSession, String> {
    let session = state.sessions.lock().unwrap().save(&name, &domains, &tlds, &chrono_now());
    Ok(session)
}

#[tauri::command]
pub fn get_sessions(state: State<'_, Arc<Database>>) -> Result<Vec<SavedSession>, String> {
    Ok(state.sessions.lock().unwrap().get_all())
}

#[tauri::command]
pub fn delete_session(state: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    state.sessions.lock().unwrap().delete(id);
    Ok(())
}

#[tauri::command]
pub fn rename_session(state: State<'_, Arc<Database>>, id: i64, name: String) -> Result<(), String> {
    state.sessions.lock().unwrap().rename(id, &name);
    Ok(())
}

// ── Watchlist commands ────────────────────────────────────────────────────────

#[tauri::command]
pub fn add_to_watchlist(
    state: State<'_, Arc<Database>>,
    domain: String,
    tld: String,
) -> Result<WatchlistEntry, String> {
    let entry = state.watchlist.lock().unwrap().add(&domain, &tld, &chrono_now());
    Ok(entry)
}

#[tauri::command]
pub fn remove_from_watchlist(state: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    state.watchlist.lock().unwrap().remove(id);
    Ok(())
}

#[tauri::command]
pub fn get_watchlist(state: State<'_, Arc<Database>>) -> Result<Vec<WatchlistEntry>, String> {
    Ok(state.watchlist.lock().unwrap().get_all())
}

#[tauri::command]
pub fn update_watchlist_entry(
    state: State<'_, Arc<Database>>,
    id: i64,
    status: String,
) -> Result<(), String> {
    state.watchlist.lock().unwrap().update(id, &chrono_now(), &status);
    Ok(())
}

// ── Export ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn export_results(results: Vec<ExportResult>, format: String) -> Result<String, String> {
    match format.as_str() {
        "json" => serde_json::to_string_pretty(&results).map_err(|e| e.to_string()),
        "csv" => {
            let mut out = String::from("domain,tld,status\n");
            for r in &results {
                out.push_str(&format!("{},{},{}\n",
                    csv_escape(&r.name), csv_escape(&r.tld), csv_escape(&r.status)));
            }
            Ok(out)
        }
        _ => Err(format!("Unknown export format: {format}")),
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    unix_secs_to_rfc3339(secs)
}

fn unix_secs_to_rfc3339(secs: u64) -> String {
    let s = secs % 60;
    let m = (secs / 60) % 60;
    let h = (secs / 3600) % 24;
    let days = secs / 86400;
    let (year, month, day) = days_to_ymd(days);
    format!("{year:04}-{month:02}-{day:02}T{h:02}:{m:02}:{s:02}Z")
}

fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    let z = days + 719468;
    let era = z / 146097;
    let doe = z % 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_csv() {
        let r = vec![
            ExportResult { name: "example".into(), tld: "com".into(), status: "available".into() },
            ExportResult { name: "test".into(), tld: "net".into(), status: "taken".into() },
        ];
        let csv = export_results(r, "csv".into()).unwrap();
        assert!(csv.starts_with("domain,tld,status\n"));
        assert!(csv.contains("example,com,available"));
    }

    #[test]
    fn export_json() {
        let r = vec![ExportResult { name: "example".into(), tld: "com".into(), status: "available".into() }];
        let json = export_results(r, "json".into()).unwrap();
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(v[0]["name"], "example");
    }

    #[test]
    fn export_unknown_format() {
        assert!(export_results(vec![], "xml".into()).is_err());
    }

    #[test]
    fn csv_escaping() {
        assert_eq!(csv_escape("hello"), "hello");
        assert_eq!(csv_escape("hel,lo"), "\"hel,lo\"");
    }

    #[test]
    fn timestamp_format() {
        let ts = unix_secs_to_rfc3339(1780228800);
        assert_eq!(ts, "2026-05-31T12:00:00Z");
    }
}
