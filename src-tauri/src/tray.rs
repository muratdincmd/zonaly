use std::sync::Arc;

use tauri::image::Image;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

use crate::commands;
use crate::db::Database;
use crate::rdap::RdapClient;

const TRAY_ICON: &[u8] = include_bytes!("../icons/tray-icon.png");
const TRAY_ICON_ALERT: &[u8] = include_bytes!("../icons/tray-icon-alert.png");

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .item(&MenuItemBuilder::with_id("show", "Show Zonaly").build(app)?)
        .item(&MenuItemBuilder::with_id("check_now", "Check Watchlist Now").build(app)?)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&MenuItemBuilder::with_id("quit", "Quit").build(app)?)
        .build()?;

    let icon = Image::from_bytes(TRAY_ICON)?;

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "check_now" => trigger_check_due(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

fn trigger_check_due(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let db_state = app.state::<Arc<Database>>();
        let rdap_state = app.state::<Arc<RdapClient>>();
        let _ = commands::check_due_watchlist(app.clone(), db_state, rdap_state).await;
    });
}

/// Swap the tray icon between the plain and alert (red-dot) variants based
/// on whether there are unread watchlist alerts.
pub fn set_alert_badge(app: &AppHandle, has_unread: bool) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let bytes = if has_unread { TRAY_ICON_ALERT } else { TRAY_ICON };
        if let Ok(icon) = Image::from_bytes(bytes) {
            let _ = tray.set_icon(Some(icon));
        }
    }
}
