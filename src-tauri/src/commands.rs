use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::task::JoinSet;

#[tauri::command]
pub fn close_splashscreen(app: AppHandle) {
    // Reveal main first (with explicit size + centring) so there is no
    // visible gap between splash closing and main appearing.
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
    // Validate scheme to prevent arbitrary command execution
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

use crate::rdap::RdapClient;
use crate::types::DomainQuery;

#[tauri::command]
pub async fn check_domains(
    app: AppHandle,
    state: State<'_, Arc<RdapClient>>,
    queries: Vec<DomainQuery>,
) -> Result<(), String> {
    let client = state.inner().clone();
    let mut set: JoinSet<()> = JoinSet::new();

    for query in queries {
        let client = client.clone();
        let app = app.clone();
        set.spawn(async move {
            let _permit = client.semaphore.clone().acquire_owned().await.ok();
            let result = client.check(&query).await;
            if let Err(e) = app.emit("domain-result", &result) {
                eprintln!("emit domain-result failed: {e}");
            }
        });
    }

    while set.join_next().await.is_some() {}

    if let Err(e) = app.emit("domain-results-complete", ()) {
        eprintln!("emit complete failed: {e}");
    }
    Ok(())
}
