import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { WatchlistEntry } from "../types/storage";

interface Props {
  entry: WatchlistEntry;
  onClose: () => void;
  onSaved: (updated: WatchlistEntry) => void;
}

// Intervals in hours: 1h, 3h, 6h, 12h, 24h, 48h, 168h (weekly)
const INTERVALS = [1, 3, 6, 12, 24, 48, 168] as const;

export function WatchlistSettingsModal({ entry, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [intervalHours, setIntervalHours] = useState(entry.checkIntervalHours ?? 24);
  const [alertAvailable, setAlertAvailable] = useState(entry.alertOnAvailable ?? true);
  const [alertChange, setAlertChange] = useState(entry.alertOnChange ?? true);
  const [alertExpiry, setAlertExpiry] = useState(entry.alertOnExpiry ?? true);
  const [expiryDays, setExpiryDays] = useState(entry.expiryAlertDays ?? 30);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { modalRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await invoke<WatchlistEntry>("update_watchlist_settings", {
        id: entry.id,
        checkIntervalHours: intervalHours,
        alertOnAvailable: alertAvailable,
        alertOnExpiry: alertExpiry,
        alertOnChange: alertChange,
        expiryAlertDays: expiryDays,
        notes: notes.trim() || null,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      console.error("update_watchlist_settings failed", err);
    } finally {
      setSaving(false);
    }
  };

  const intervalLabel = (h: number) => {
    if (h === 1)   return t("watchlist.interval1h");
    if (h === 3)   return t("watchlist.interval3h");
    if (h === 6)   return t("watchlist.interval6h");
    if (h === 12)  return t("watchlist.interval12h");
    if (h === 24)  return t("watchlist.interval24h");
    if (h === 48)  return t("watchlist.interval48h");
    return t("watchlist.intervalWeekly");
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={modalRef}
        className="modal wl-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("watchlist.settings")}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-domain-name">{entry.domain}.{entry.tld}</span>
            <span className="modal-subtitle">{t("watchlist.settings")}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t("details.close")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="wl-settings-body">
          {/* Check interval */}
          <div className="wl-settings-section">
            <span className="wl-settings-label">{t("watchlist.checkInterval")}</span>
            <div className="wl-interval-options">
              {INTERVALS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`wl-interval-btn${intervalHours === h ? " wl-interval-btn--active" : ""}`}
                  onClick={() => setIntervalHours(h)}
                >
                  {intervalLabel(h)}
                </button>
              ))}
            </div>
          </div>

          {/* Alert toggles */}
          <div className="wl-settings-section">
            <span className="wl-settings-label">{t("watchlist.settings")}</span>
            <label className="wl-checkbox-row">
              <input type="checkbox" checked={alertAvailable} onChange={(e) => setAlertAvailable(e.target.checked)} />
              <span>{t("watchlist.alertOnAvailable")}</span>
            </label>
            <label className="wl-checkbox-row">
              <input type="checkbox" checked={alertChange} onChange={(e) => setAlertChange(e.target.checked)} />
              <span>{t("watchlist.alertOnChange")}</span>
            </label>
            <label className="wl-checkbox-row">
              <input type="checkbox" checked={alertExpiry} onChange={(e) => setAlertExpiry(e.target.checked)} />
              <span>
                {t("watchlist.alertOnExpiry")}{" "}
                <input
                  type="number"
                  className="wl-days-input"
                  min={1}
                  max={365}
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Math.max(1, Math.min(365, Number(e.target.value))))}
                  disabled={!alertExpiry}
                />{" "}
                {t("watchlist.alertDaysSuffix")}
              </span>
            </label>
          </div>

          {/* Notes */}
          <div className="wl-settings-section">
            <label className="wl-settings-label" htmlFor="wl-notes">
              {t("watchlist.notesLabel")}
            </label>
            <textarea
              id="wl-notes"
              className="wl-notes-textarea"
              placeholder={t("watchlist.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="wl-settings-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            {t("watchlist.cancel")}
          </button>
          <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "…" : t("watchlist.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
