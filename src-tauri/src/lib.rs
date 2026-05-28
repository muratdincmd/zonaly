mod commands;
mod rdap;
mod types;

use std::sync::Arc;

use rdap::RdapClient;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(RdapClient::new()))
        .invoke_handler(tauri::generate_handler![
            commands::check_domains,
            commands::open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
