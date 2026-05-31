import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { DomainResult } from "../types/domain";
import type { WatchlistAlert, WatchlistEntry } from "../types/storage";
import { WatchlistSettingsModal } from "./WatchlistSettingsModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onWatchlistChange?: () => void;
  onOpenDetails?: (result: DomainResult) => void;
  onUnreadChange?: (count: number) => void;
}

function relativeTime(ts: string | null): string {
  if (!ts) return "";
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2)  return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return ts; }
}

function nextCheckLabel(ts: string | null, t: (k: string) => string): string {
  if (!ts) return t("watchlist.neverChecked");
  try {
    const diff = new Date(ts).getTime() - Date.now();
    if (diff <= 0) return t("watchlist.overdue");
    const mins = Math.ceil(diff / 60000);
    if (mins < 60)  return `in ${mins}m`;
    const hrs = Math.ceil(diff / 3600000);
    if (hrs < 24)   return `in ${hrs}h`;
    return `in ${Math.ceil(diff / 86400000)}d`;
  } catch { return ts; }
}

function isOverdue(ts: string | null): boolean {
  if (!ts) return false;
  return new Date(ts).getTime() <= Date.now();
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cls =
    status === "available" ? "side-panel-badge side-panel-badge--available"
    : status === "taken"   ? "side-panel-badge side-panel-badge--taken"
    : "side-panel-badge side-panel-badge--error";
  return <span className={cls}>{status}</span>;
}

function AlertTypeIcon({ type }: { type: string }) {
  if (type === "available") return <span className="wl-alert-icon wl-alert-icon--available">✓</span>;
  if (type === "expiry")    return <span className="wl-alert-icon wl-alert-icon--expiry">⏰</span>;
  return <span className="wl-alert-icon wl-alert-icon--change">↻</span>;
}

export function WatchlistPanel({ open, onClose, onWatchlistChange, onOpenDetails, onUnreadChange }: Props) {
  const { t } = useTranslation();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [alerts, setAlerts] = useState<WatchlistAlert[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [checking, setChecking] = useState<Set<number>>(new Set());
  const [checkingAll, setCheckingAll] = useState(false);
  const [settingsFor, setSettingsFor] = useState<WatchlistEntry | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadWatchlist = () => {
    invoke<WatchlistEntry[]>("get_watchlist")
      .then(setWatchlist)
      .catch(console.error);
  };

  const loadAlerts = () => {
    invoke<WatchlistAlert[]>("get_watchlist_alerts", { unreadOnly: true })
      .then((a) => {
        setAlerts(a);
        onUnreadChange?.(a.length);
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (open) { loadWatchlist(); loadAlerts(); }
  }, [open]);

  // Refresh when backend emits watchlist-updated event
  useEffect(() => {
    if (!open) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("watchlist-updated", () => { loadWatchlist(); loadAlerts(); })
        .then((fn) => { unlisten = fn; });
    });
    return () => unlisten?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleRemove = async (id: number) => {
    await invoke("remove_from_watchlist", { id });
    loadWatchlist();
    onWatchlistChange?.();
  };

  const handleCheckNow = async (entry: WatchlistEntry) => {
    setChecking((prev) => new Set(prev).add(entry.id));
    try {
      await invoke("check_watchlist_entry_now", { id: entry.id });
      loadWatchlist();
      loadAlerts();
    } catch (e) {
      console.error("check_watchlist_entry_now failed", e);
    } finally {
      setChecking((prev) => { const n = new Set(prev); n.delete(entry.id); return n; });
    }
  };

  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      await invoke("check_due_watchlist");
      loadWatchlist();
      loadAlerts();
    } catch (e) {
      console.error("check_due_watchlist failed", e);
    } finally {
      setCheckingAll(false);
    }
  };

  const handleMarkRead = async (alertId: number) => {
    await invoke("mark_watchlist_alert_read", { alertId });
    loadAlerts();
  };

  const handleMarkAllRead = async () => {
    await invoke("mark_all_watchlist_alerts_read");
    loadAlerts();
  };

  const dueCount = watchlist.filter((e) => !e.nextCheckAt || isOverdue(e.nextCheckAt)).length;
  const monitoredCount = watchlist.filter((e) => e.checkIntervalHours > 0).length;

  return (
    <>
      {open && <div className="side-panel-backdrop" onClick={onClose} aria-hidden="true" />}
      <div
        ref={panelRef}
        className={`side-panel${open ? " side-panel-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("watchlist.panelTitle")}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="side-panel-header">
          <h2 className="side-panel-title">
            {t("watchlist.panelTitle")}
            {alerts.length > 0 && <span className="fav-badge">{alerts.length}</span>}
          </h2>
          <div className="side-panel-header-actions">
            <button
              className="side-panel-action-btn"
              onClick={() => void handleCheckAll()}
              disabled={checkingAll || dueCount === 0}
              title={t("watchlist.checkAllDue")}
              aria-label={t("watchlist.checkAllDue")}
            >
              {checkingAll ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="spin" aria-hidden="true">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="14" strokeDashoffset="5"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M10.5 6A4.5 4.5 0 112 4m0 0V1m0 3H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span className="side-panel-action-label">{t("watchlist.checkAllDue")}</span>
              {dueCount > 0 && <span className="fav-due-badge">{dueCount}</span>}
            </button>
            <button className="side-panel-close" onClick={onClose} aria-label={t("details.close")}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="side-panel-body">
          {/* Unread alerts banner */}
          {alerts.length > 0 && (
            <div className="wl-alerts-section">
              <div
                className="wl-alerts-header"
                onClick={() => setAlertsOpen((v) => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAlertsOpen((v) => !v); }}
              >
                <span className="wl-alerts-title">
                  {t("watchlist.unreadAlerts", { count: alerts.length })}
                </span>
                <div className="wl-alerts-header-right">
                  <button
                    type="button"
                    className="wl-mark-all-btn"
                    onClick={(e) => { e.stopPropagation(); void handleMarkAllRead(); }}
                  >
                    {t("watchlist.markAllRead")}
                  </button>
                  <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="none"
                    className={`wl-chevron${alertsOpen ? " wl-chevron--open" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              {alertsOpen && (
                <div className="wl-alerts-list">
                  {alerts.map((a) => (
                    <div key={a.id} className="wl-alert-item">
                      <AlertTypeIcon type={a.alertType} />
                      <span className="wl-alert-message">{a.message}</span>
                      <button
                        type="button"
                        className="wl-alert-dismiss"
                        onClick={() => void handleMarkRead(a.id)}
                        aria-label="Dismiss"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Watchlist entries */}
          <div className="side-panel-list">
            {watchlist.length === 0 ? (
              <p className="side-panel-empty">{t("watchlist.empty")}</p>
            ) : (
              watchlist.map((entry) => {
                const isTaken = entry.lastStatus === "taken";
                const overdue = !entry.nextCheckAt || isOverdue(entry.nextCheckAt);
                const isMonitored = entry.checkIntervalHours > 0;

                const handleRowClick = () => {
                  if (!isTaken || !onOpenDetails) return;
                  onOpenDetails({ name: entry.domain, tld: entry.tld, status: { kind: "taken" }, source: undefined });
                };

                return (
                  <div
                    key={entry.id}
                    className={`side-panel-item side-panel-item--watchlist${isTaken && onOpenDetails ? " side-panel-item--clickable" : ""}`}
                    onClick={handleRowClick}
                    role={isTaken && onOpenDetails ? "button" : undefined}
                    tabIndex={isTaken && onOpenDetails ? 0 : undefined}
                    onKeyDown={isTaken && onOpenDetails
                      ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRowClick(); } }
                      : undefined}
                  >
                    <div className="side-panel-item-main">
                      <span className="side-panel-item-title">
                        <span className="domain-name">{entry.domain}</span>
                        <span className="domain-tld">.{entry.tld}</span>
                        {isMonitored && (
                          <span className="wl-monitoring-dot" title={t("watchlist.monitoringActive")}>●</span>
                        )}
                      </span>
                      <span className="side-panel-item-meta">
                        <StatusBadge status={entry.lastStatus} />
                        {entry.lastCheckedAt && (
                          <span className="side-panel-item-time">
                            {relativeTime(entry.lastCheckedAt)}
                          </span>
                        )}
                        {isMonitored && (
                          <span className={`wl-next-check${overdue ? " wl-next-check--overdue" : ""}`}>
                            {nextCheckLabel(entry.nextCheckAt, t)}
                          </span>
                        )}
                      </span>
                      {entry.notes && (
                        <span className="wl-item-notes">{entry.notes}</span>
                      )}
                    </div>
                    <div className="side-panel-item-actions">
                      <button
                        className="side-panel-item-action"
                        onClick={(e) => { e.stopPropagation(); void handleCheckNow(entry); }}
                        disabled={checking.has(entry.id)}
                        aria-label={t("watchlist.checkNow")}
                        title={t("watchlist.checkNow")}
                      >
                        {checking.has(entry.id) ? (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="spin" aria-hidden="true">
                            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="14" strokeDashoffset="5"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path d="M10.5 6A4.5 4.5 0 112 4m0 0V1m0 3H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                      <button
                        className="side-panel-item-action"
                        onClick={(e) => { e.stopPropagation(); setSettingsFor(entry); }}
                        aria-label={t("watchlist.settings")}
                        title={t("watchlist.settings")}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.2"/>
                          <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.6 2.6l1.1 1.1M8.3 8.3l1.1 1.1M9.4 2.6L8.3 3.7M3.7 8.3L2.6 9.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </button>
                      <button
                        className="side-panel-item-delete"
                        onClick={(e) => { e.stopPropagation(); void handleRemove(entry.id); }}
                        aria-label={t("watchlist.remove")}
                        title={t("watchlist.remove")}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        {watchlist.length > 0 && (
          <div className="side-panel-footer">
            <span className="side-panel-footer-text">
              {watchlist.length} {t("watchlist.panelTitle").toLowerCase()}
              {monitoredCount > 0 && ` · ${monitoredCount} ${t("watchlist.monitoringActive").toLowerCase()}`}
              {alerts.length > 0 && ` · ${t("watchlist.unreadAlerts", { count: alerts.length })}`}
              {dueCount > 0 && ` · ${t("watchlist.dueForCheck", { count: dueCount })}`}
            </span>
          </div>
        )}
      </div>

      {settingsFor && (
        <WatchlistSettingsModal
          entry={settingsFor}
          onClose={() => setSettingsFor(null)}
          onSaved={(updated) => {
            setWatchlist((prev) => prev.map((e) => e.id === updated.id ? updated : e));
            setSettingsFor(null);
          }}
        />
      )}
    </>
  );
}
