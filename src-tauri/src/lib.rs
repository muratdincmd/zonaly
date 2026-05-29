mod commands;
mod rdap;
mod types;

use std::sync::Arc;

use rdap::RdapClient;
#[cfg(target_os = "windows")]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(RdapClient::new()))
        .invoke_handler(tauri::generate_handler![
            commands::check_domains,
            commands::open_url,
            commands::close_splashscreen,
            commands::fetch_domain_details,
        ])
        .setup(|_app| {
            // Remove native decorations on Windows so the custom React
            // title bar takes over. macOS and Linux keep native chrome.
            #[cfg(target_os = "windows")]
            {
                if let Some(win) = _app.get_webview_window("main") {
                    let _ = win.set_decorations(false);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
