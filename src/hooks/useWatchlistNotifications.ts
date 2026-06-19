import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { useTranslation } from "react-i18next";

interface WatchlistAlertEvent {
  alertType: "available" | "status_change" | "expiry";
  domain: string;
  tld: string;
}

const TITLE_KEY: Record<WatchlistAlertEvent["alertType"], string> = {
  available: "watchlist.alertTypeAvailable",
  status_change: "watchlist.alertTypeChange",
  expiry: "watchlist.alertTypeExpiry",
};

/**
 * Fires a native OS notification the moment the backend creates a new
 * watchlist alert (available / status change / expiry), regardless of
 * whether the Watchlist panel is open.
 */
export function useWatchlistNotifications() {
  const { t } = useTranslation();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    (async () => {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      if (!granted) return;

      unlisten = await listen<WatchlistAlertEvent>("watchlist-alert-created", (event) => {
        const { alertType, domain, tld } = event.payload;
        sendNotification({
          title: t(TITLE_KEY[alertType]),
          body: `${domain}.${tld}`,
        });
      });
    })().catch((e) => console.error("[notifications] setup failed:", e));

    return () => { unlisten?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
