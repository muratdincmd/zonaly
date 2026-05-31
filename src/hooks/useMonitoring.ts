import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const STARTUP_DELAY_MS = 3000;

/**
 * On startup (after a short delay) and every 15 minutes, calls
 * check_due_watchlist so scheduled monitoring runs automatically.
 * Fire-and-forget — does not block the UI.
 */
export function useMonitoring(onAlertsChanged?: () => void) {
  useEffect(() => {
    const run = () => {
      invoke("check_due_watchlist")
        .then(() => { onAlertsChanged?.(); })
        .catch((e) => console.error("[monitoring] check_due_watchlist failed:", e));
    };

    const startup = setTimeout(run, STARTUP_DELAY_MS);
    const interval = setInterval(run, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(startup);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
