mod commands;
mod db;
mod rdap;
mod types;

use std::sync::Arc;

use db::Database;
use rdap::RdapClient;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::check_domains,
            commands::open_url,
            commands::open_downloads_folder,
            commands::close_splashscreen,
            commands::fetch_domain_details,
            commands::get_history,
            commands::delete_history_entry,
            commands::clear_history,
            commands::save_session,
            commands::get_sessions,
            commands::delete_session,
            commands::rename_session,
            commands::add_to_watchlist,
            commands::remove_from_watchlist,
            commands::get_watchlist,
            commands::update_watchlist_entry,
            commands::get_watchlist_stats,
            commands::update_watchlist_settings,
            commands::check_watchlist_entry_now,
            commands::check_due_watchlist,
            commands::get_watchlist_alerts,
            commands::mark_watchlist_alert_read,
            commands::mark_all_watchlist_alerts_read,
            commands::export_results,
        ])
        .setup(|app| {
            let data_dir = app.path().app_data_dir().ok();
            if let Some(ref dir) = data_dir {
                let _ = std::fs::create_dir_all(dir);
            }

            app.manage(Arc::new(RdapClient::new(data_dir.clone())));

            let db_path = data_dir
                .map(|d| d.join("zonaly.db"))
                .unwrap_or_else(|| std::path::PathBuf::from("zonaly.db"));

            match Database::open(db_path) {
                Ok(db) => { app.manage(Arc::new(db)); }
                Err(e) => { eprintln!("Failed to open database: {e}"); }
            }

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
