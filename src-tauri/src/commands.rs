use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;
use tokio::task::JoinSet;

use crate::rdap::RdapClient;
use crate::types::{DomainDetails, DomainQuery, DomainResult, DomainStatus};

/// Maximum wall-clock time for a full batch of domain checks.
/// Queries still pending after this deadline are marked as timed out.
const OVERALL_CHECK_TIMEOUT_SECS: u64 = 30;

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

#[tauri::command]
pub async fn check_domains(
    app: AppHandle,
    state: State<'_, Arc<RdapClient>>,
    queries: Vec<DomainQuery>,
) -> Result<(), String> {
    let client = state.inner().clone();
    let mut set: JoinSet<()> = JoinSet::new();

    // Track pending queries so we can emit timeout errors for stragglers.
    let pending: Arc<Mutex<HashMap<String, DomainQuery>>> = Arc::new(Mutex::new(
        queries
            .iter()
            .map(|q| (format!("{}.{}", q.name, q.tld), q.clone()))
            .collect(),
    ));

    for query in queries {
        let client = client.clone();
        let app_clone = app.clone();
        let pending = pending.clone();

        set.spawn(async move {
            let _permit = client.semaphore.clone().acquire_owned().await.ok();
            let result = client.check(&query).await;

            // Remove from pending before emitting so the timeout handler
            // doesn't double-emit for a query that finished just in time.
            pending
                .lock()
                .await
                .remove(&format!("{}.{}", result.name, result.tld));

            if let Err(e) = app_clone.emit("domain-result", &result) {
                eprintln!("emit domain-result failed: {e}");
            }
        });
    }

    let outcome = tokio::time::timeout(
        Duration::from_secs(OVERALL_CHECK_TIMEOUT_SECS),
        async { while set.join_next().await.is_some() {} },
    )
    .await;

    if outcome.is_err() {
        set.abort_all();
        let remaining = pending.lock().await;
        eprintln!(
            "Overall check timeout reached; {} queries did not complete",
            remaining.len()
        );
        for query in remaining.values() {
            let result = DomainResult {
                name: query.name.clone(),
                tld: query.tld.clone(),
                status: DomainStatus::Error { message: "err:timeout".into() },
                source: None,
            };
            let _ = app.emit("domain-result", &result);
        }
    }

    if let Err(e) = app.emit("domain-results-complete", ()) {
        eprintln!("emit complete failed: {e}");
    }
    Ok(())
}
