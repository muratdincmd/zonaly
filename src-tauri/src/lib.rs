mod commands;
mod rdap;
mod types;

use std::sync::Arc;

use rdap::RdapClient;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::check_domains,
            commands::open_url,
            commands::close_splashscreen,
            commands::fetch_domain_details,
        ])
        .setup(|app| {
            // Resolve the per-app data directory for the RDAP bootstrap disk cache.
            let cache_dir = app.path().app_data_dir().ok();
            if let Some(ref dir) = cache_dir {
                let _ = std::fs::create_dir_all(dir);
            }

            // Register RdapClient as shared state with cache support.
            app.manage(Arc::new(RdapClient::new(cache_dir)));

            // Remove native decorations on Windows so the custom React
            // title bar takes over. macOS and Linux keep native chrome.
            #[cfg(target_os = "windows")]
            {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_decorations(false);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
