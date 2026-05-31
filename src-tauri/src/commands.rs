use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;
use tokio::task::JoinSet;

use crate::db::{self, Database, FavoriteAlert, FavoriteEntry, FavoriteStats, HistoryEntry, SavedSession, WatchlistEntry};
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
pub fn open_downloads_folder() {
    // Open the system default Downloads directory in the file manager.
    // Falls back silently if the path can't be determined.
    let downloads = dirs_next();
    if let Some(path) = downloads {
        let path_str = path.to_string_lossy().to_string();
        #[cfg(target_os = "windows")]
        let _ = std::process::Command::new("explorer").arg(&path_str).spawn();
        #[cfg(target_os = "macos")]
        let _ = std::process::Command::new("open").arg(&path_str).spawn();
        #[cfg(target_os = "linux")]
        let _ = std::process::Command::new("xdg-open").arg(&path_str).spawn();
    }
}

fn dirs_next() -> Option<std::path::PathBuf> {
    // Resolve the user's Downloads directory without an extra crate.
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()?;
    let downloads = std::path::PathBuf::from(home).join("Downloads");
    if downloads.exists() { Some(downloads) } else { None }
}

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
                let conn = db.conn.lock().unwrap();
                let _ = db::history::add(
                    &conn, &chrono_now(), &unique_names, &unique_tlds, available, taken, errors,
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
    let conn = state.conn.lock().unwrap();
    db::history::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_history_entry(state: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::history::delete(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history(state: State<'_, Arc<Database>>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::history::clear(&conn).map_err(|e| e.to_string())
}

// ── Session commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn save_session(
    state: State<'_, Arc<Database>>,
    name: String,
    domains: Vec<String>,
    tlds: Vec<String>,
) -> Result<SavedSession, String> {
    let conn = state.conn.lock().unwrap();
    db::sessions::save(&conn, &name, &domains, &tlds, &chrono_now()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sessions(state: State<'_, Arc<Database>>) -> Result<Vec<SavedSession>, String> {
    let conn = state.conn.lock().unwrap();
    db::sessions::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_session(state: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::sessions::delete(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_session(state: State<'_, Arc<Database>>, id: i64, name: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::sessions::rename(&conn, id, &name).map_err(|e| e.to_string())
}

// ── Watchlist commands ────────────────────────────────────────────────────────

#[tauri::command]
pub fn add_to_watchlist(
    state: State<'_, Arc<Database>>,
    domain: String,
    tld: String,
) -> Result<WatchlistEntry, String> {
    let conn = state.conn.lock().unwrap();
    db::watchlist::add(&conn, &domain, &tld, &chrono_now()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_from_watchlist(state: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::watchlist::remove(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_watchlist(state: State<'_, Arc<Database>>) -> Result<Vec<WatchlistEntry>, String> {
    let conn = state.conn.lock().unwrap();
    db::watchlist::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_watchlist_entry(
    state: State<'_, Arc<Database>>,
    id: i64,
    status: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::watchlist::update(&conn, id, &chrono_now(), &status).map_err(|e| e.to_string())
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

// ── Favorites commands ────────────────────────────────────────────────────────

#[tauri::command]
pub fn add_favorite(
    state: State<'_, Arc<Database>>,
    domain: String,
    tld: String,
    notes: Option<String>,
) -> Result<FavoriteEntry, String> {
    let conn = state.conn.lock().unwrap();
    db::favorites::add(&conn, &domain, &tld, notes.as_deref(), &chrono_now())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_favorite(state: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::favorites::remove(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_favorites(state: State<'_, Arc<Database>>) -> Result<Vec<FavoriteEntry>, String> {
    let conn = state.conn.lock().unwrap();
    db::favorites::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_favorite_stats(state: State<'_, Arc<Database>>) -> Result<FavoriteStats, String> {
    let conn = state.conn.lock().unwrap();
    db::favorites::get_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_favorite_settings(
    state: State<'_, Arc<Database>>,
    id: i64,
    check_interval_hours: i64,
    alert_on_available: bool,
    alert_on_expiry: bool,
    alert_on_change: bool,
    expiry_alert_days: i64,
    notes: Option<String>,
) -> Result<FavoriteEntry, String> {
    let conn = state.conn.lock().unwrap();
    db::favorites::update_settings(
        &conn,
        id,
        check_interval_hours,
        alert_on_available,
        alert_on_expiry,
        alert_on_change,
        expiry_alert_days,
        notes.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_favorite_now(
    app: AppHandle,
    db_state: State<'_, Arc<Database>>,
    rdap_state: State<'_, Arc<RdapClient>>,
    id: i64,
) -> Result<FavoriteEntry, String> {
    let (domain, tld, prev_status, prev_registrar, alert_on_available, alert_on_change,
         alert_on_expiry, expiry_alert_days) = {
        let conn = db_state.conn.lock().unwrap();
        let all = db::favorites::get_all(&conn).map_err(|e| e.to_string())?;
        let entry = all.into_iter().find(|e| e.id == id)
            .ok_or_else(|| "Favorite not found".to_string())?;
        (
            entry.domain.clone(), entry.tld.clone(),
            entry.last_status.clone(), entry.last_registrar.clone(),
            entry.alert_on_available, entry.alert_on_change,
            entry.alert_on_expiry, entry.expiry_alert_days,
        )
    };

    let client = rdap_state.inner().clone();
    let query = crate::types::DomainQuery { name: domain.clone(), tld: tld.clone() };
    let _permit = client.semaphore.clone().acquire_owned().await.ok();
    let result = client.check(&query).await;

    let new_status = match &result.status {
        crate::types::DomainStatus::Available => "available",
        crate::types::DomainStatus::Taken => "taken",
        crate::types::DomainStatus::Error { .. } => "error",
    };

    // Fetch details if taken (to get registrar + expiry)
    let (new_registrar, new_expiry) = if new_status == "taken" {
        match client.fetch_details(&domain, &tld).await {
            Ok(details) => (details.registrar, details.expires),
            Err(_) => (None, None),
        }
    } else {
        (None, None)
    };

    let now = chrono_now();
    let next_check_at = {
        let (h, interval_secs) = {
            let conn = db_state.conn.lock().unwrap();
            let all = db::favorites::get_all(&conn).map_err(|e| e.to_string())?;
            let entry = all.into_iter().find(|e| e.id == id).unwrap();
            (entry.check_interval_hours, entry.check_interval_hours * 3600)
        };
        let _ = h;
        add_seconds_to_iso(&now, interval_secs)
    };

    {
        let conn = db_state.conn.lock().unwrap();
        db::favorites::update_check_result(
            &conn, id, &now, new_status,
            new_registrar.as_deref(), new_expiry.as_deref(), &next_check_at,
        ).map_err(|e| e.to_string())?;

        // Generate alerts
        if alert_on_available && new_status == "available"
            && prev_status.as_deref() != Some("available")
        {
            let msg = format!("{domain}.{tld} is now available!");
            let _ = db::favorites::insert_alert(&conn, id, "available", &msg, &now);
        }
        if alert_on_change {
            let status_changed = prev_status.as_deref().map_or(false, |p| p != new_status);
            let registrar_changed = prev_registrar != new_registrar
                && prev_registrar.is_some()
                && new_registrar.is_some();
            if status_changed || registrar_changed {
                let msg = format!("{domain}.{tld} changed: status={new_status}");
                let _ = db::favorites::insert_alert(&conn, id, "status_change", &msg, &now);
            }
        }
        if alert_on_expiry {
            if let Some(ref expiry) = new_expiry {
                let days_left = days_until_iso(expiry);
                if days_left >= 0 && days_left <= expiry_alert_days
                    && !db::favorites::expiry_alert_exists(&conn, id).unwrap_or(false)
                {
                    let msg = format!("{domain}.{tld} expires in {days_left} day(s)");
                    let _ = db::favorites::insert_alert(&conn, id, "expiry", &msg, &now);
                }
            }
        }
    }

    // Emit event so frontend can refresh stats
    let _ = app.emit("favorites-updated", ());

    let conn = db_state.conn.lock().unwrap();
    let all = db::favorites::get_all(&conn).map_err(|e| e.to_string())?;
    all.into_iter().find(|e| e.id == id)
        .ok_or_else(|| "Favorite not found after update".to_string())
}

#[tauri::command]
pub async fn check_due_favorites(
    app: AppHandle,
    db_state: State<'_, Arc<Database>>,
    rdap_state: State<'_, Arc<RdapClient>>,
) -> Result<Vec<FavoriteEntry>, String> {
    let now = chrono_now();
    let due = {
        let conn = db_state.conn.lock().unwrap();
        db::favorites::get_due(&conn, &now).map_err(|e| e.to_string())?
    };

    let mut updated = Vec::new();
    for entry in due {
        match check_favorite_now(
            app.clone(),
            db_state.clone(),
            rdap_state.clone(),
            entry.id,
        ).await {
            Ok(e) => updated.push(e),
            Err(e) => eprintln!("[zonaly] check_due_favorites error for id={}: {e}", entry.id),
        }
    }
    Ok(updated)
}

#[tauri::command]
pub fn get_favorite_alerts(
    state: State<'_, Arc<Database>>,
    unread_only: bool,
) -> Result<Vec<FavoriteAlert>, String> {
    let conn = state.conn.lock().unwrap();
    db::favorites::get_alerts(&conn, unread_only).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_alert_read(state: State<'_, Arc<Database>>, alert_id: i64) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::favorites::mark_alert_read(&conn, alert_id, &chrono_now()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_all_alerts_read(state: State<'_, Arc<Database>>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::favorites::mark_all_alerts_read(&conn, &chrono_now()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_favorited(
    state: State<'_, Arc<Database>>,
    domain: String,
    tld: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().unwrap();
    db::favorites::is_favorited(&conn, &domain, &tld).map_err(|e| e.to_string())
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

/// Add `seconds` to an ISO 8601 UTC string, returns a new ISO string.
fn add_seconds_to_iso(iso: &str, seconds: i64) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    // Parse the iso string back to unix secs
    let base = iso_to_unix_secs(iso).unwrap_or_else(|| {
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
    });
    unix_secs_to_rfc3339(base.saturating_add(seconds as u64))
}

/// Parse a simple ISO 8601 UTC string (YYYY-MM-DDTHH:MM:SSZ) to unix seconds.
fn iso_to_unix_secs(iso: &str) -> Option<u64> {
    let s = iso.trim_end_matches('Z');
    let parts: Vec<&str> = s.splitn(2, 'T').collect();
    if parts.len() != 2 { return None; }
    let date: Vec<u64> = parts[0].split('-').filter_map(|p| p.parse().ok()).collect();
    let time: Vec<u64> = parts[1].split(':').filter_map(|p| p.parse().ok()).collect();
    if date.len() < 3 || time.len() < 3 { return None; }
    let (y, mo, d, h, mi, sc) = (date[0], date[1], date[2], time[0], time[1], time[2]);
    // Days since Unix epoch via days_from_ymd
    let days = ymd_to_days(y, mo, d)?;
    Some(days * 86400 + h * 3600 + mi * 60 + sc)
}

fn ymd_to_days(y: u64, m: u64, d: u64) -> Option<u64> {
    if y < 1970 { return None; }
    // Gregorian days since 1970-01-01
    let (y, m) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = y / 400;
    let yoe = y % 400;
    let doy = (153 * m + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + doe;
    // subtract days up to 1970-01-01 (which is day 719468 in this system)
    Some(days.saturating_sub(719468))
}

/// Returns days until an ISO date from now (negative if past).
fn days_until_iso(iso: &str) -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    match iso_to_unix_secs(iso) {
        Some(target) => (target as i64 - now as i64) / 86400,
        None => i64::MIN,
    }
}

/// Public re-export of chrono_now for use in db::favorites::get_stats.
pub fn chrono_now_pub() -> String {
    chrono_now()
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
