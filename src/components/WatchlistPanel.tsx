import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { WatchlistEntry } from "../types/storage";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatTimestamp(ts: string | null, locale: string): string {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cls =
    status === "available"
      ? "side-panel-badge side-panel-badge--available"
      : status === "taken"
      ? "side-panel-badge side-panel-badge--taken"
      : "side-panel-badge side-panel-badge--error";
  return <span className={cls}>{status}</span>;
}

export function WatchlistPanel({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [checking, setChecking] = useState<Set<number>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  const loadWatchlist = () => {
    invoke<WatchlistEntry[]>("get_watchlist")
      .then(setWatchlist)
      .catch(console.error);
  };

  useEffect(() => {
    if (open) loadWatchlist();
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleRemove = async (id: number) => {
    await invoke("remove_from_watchlist", { id });
    loadWatchlist();
  };

  const handleCheckNow = async (entry: WatchlistEntry) => {
    setChecking((prev) => new Set(prev).add(entry.id));
    try {
      // Use the existing check_domains command for a single domain
      const { listen } = await import("@tauri-apps/api/event");
      const { invoke: inv } = await import("@tauri-apps/api/core");

      let status = "error";
      const unlisten = await listen<{ status: { kind: string } }>("domain-result", (event) => {
        const kind = event.payload.status.kind;
        status = kind === "available" ? "available" : kind === "taken" ? "taken" : "error";
      });

      const completeUnlisten = await listen("domain-results-complete", async () => {
        completeUnlisten();
        unlisten();
        await inv("update_watchlist_entry", { id: entry.id, status });
        loadWatchlist();
        setChecking((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
      });

      await inv("check_domains", {
        queries: [{ name: entry.domain, tld: entry.tld }],
      });
    } catch (e) {
      console.error("check now failed", e);
      setChecking((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  return (
    <>
      {open && (
        <div
          className="side-panel-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        ref={panelRef}
        className={`side-panel${open ? " side-panel-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("watchlist.panelTitle")}
        tabIndex={-1}
      >
        <div className="side-panel-header">
          <h2 className="side-panel-title">{t("watchlist.panelTitle")}</h2>
          <button
            className="side-panel-close"
            onClick={onClose}
            aria-label={t("details.close")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="side-panel-body">
          <div className="side-panel-list">
            {watchlist.length === 0 ? (
              <p className="side-panel-empty">{t("watchlist.empty")}</p>
            ) : (
              watchlist.map((entry) => (
                <div key={entry.id} className="side-panel-item side-panel-item--watchlist">
                  <div className="side-panel-item-main">
                    <span className="side-panel-item-title">
                      <span className="domain-name">{entry.domain}</span>
                      <span className="domain-tld">.{entry.tld}</span>
                    </span>
                    <span className="side-panel-item-meta">
                      <StatusBadge status={entry.lastStatus} />
                      <span className="side-panel-item-time">
                        {t("watchlist.lastChecked")}{" "}
                        {formatTimestamp(entry.lastCheckedAt, i18n.language)}
                      </span>
                    </span>
                  </div>
                  <div className="side-panel-item-actions">
                    <button
                      className="side-panel-item-action"
                      onClick={() => void handleCheckNow(entry)}
                      disabled={checking.has(entry.id)}
                      aria-label={t("watchlist.checkNow")}
                      title={t("watchlist.checkNow")}
                    >
                      {checking.has(entry.id) ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="spin">
                          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="14" strokeDashoffset="5"/>
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M10.5 6A4.5 4.5 0 112 4m0 0V1m0 3H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <button
                      className="side-panel-item-delete"
                      onClick={() => void handleRemove(entry.id)}
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
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
