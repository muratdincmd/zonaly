import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { HistoryEntry, SavedSession } from "../types/storage";

interface Props {
  open: boolean;
  onClose: () => void;
  onRestoreHistory: (entry: HistoryEntry) => void;
  onLoadSession: (session: SavedSession) => void;
}

type PanelTab = "history" | "saved";

function formatTimestamp(ts: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

export function HistoryPanel({
  open,
  onClose,
  onRestoreHistory,
  onLoadSession,
}: Props) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<PanelTab>("history");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = () => {
    invoke<HistoryEntry[]>("get_history")
      .then(setHistory)
      .catch(console.error);
  };

  const loadSessions = () => {
    invoke<SavedSession[]>("get_sessions")
      .then(setSessions)
      .catch(console.error);
  };

  useEffect(() => {
    if (open) {
      loadHistory();
      loadSessions();
    }
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

  // Focus trap: focus the panel on open
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleDeleteHistory = async (id: number) => {
    await invoke("delete_history_entry", { id });
    loadHistory();
  };

  const handleClearHistory = async () => {
    await invoke("clear_history");
    loadHistory();
  };

  const handleDeleteSession = async (id: number) => {
    await invoke("delete_session", { id });
    loadSessions();
  };

  const startRename = (session: SavedSession) => {
    setRenamingId(session.id);
    setRenameValue(session.name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const commitRename = async (id: number) => {
    const name = renameValue.trim();
    if (name) {
      await invoke("rename_session", { id, name });
      loadSessions();
    }
    setRenamingId(null);
  };

  return (
    <>
      {/* Backdrop — only rendered when open */}
      {open && (
        <div
          className="side-panel-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel — always in DOM so slide animation works */}
      <div
        ref={panelRef}
        className={`side-panel${open ? " side-panel-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("history.panelTitle")}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="side-panel-header">
          <h2 className="side-panel-title">{t("history.panelTitle")}</h2>
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

        {/* Tab switcher */}
        <div className="side-panel-tabs">
          <button
            className={`side-panel-tab${activeTab === "history" ? " side-panel-tab--active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            {t("history.tabHistory")}
          </button>
          <button
            className={`side-panel-tab${activeTab === "saved" ? " side-panel-tab--active" : ""}`}
            onClick={() => setActiveTab("saved")}
          >
            {t("sessions.tabSaved")}
          </button>
        </div>

        {/* Body */}
        <div className="side-panel-body">
          {activeTab === "history" && (
            <div className="side-panel-list">
              {history.length === 0 ? (
                <p className="side-panel-empty">{t("history.empty")}</p>
              ) : (
                <>
                  <div className="side-panel-list-actions">
                    <button
                      className="side-panel-action-btn side-panel-action-btn--danger"
                      onClick={() => void handleClearHistory()}
                    >
                      {t("history.clearAll")}
                    </button>
                  </div>
                  {history.map((entry) => (
                    <div key={entry.id} className="side-panel-item">
                      <div
                        className="side-panel-item-main"
                        role="button"
                        tabIndex={0}
                        onClick={() => { onRestoreHistory(entry); onClose(); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRestoreHistory(entry);
                            onClose();
                          }
                        }}
                      >
                        <span className="side-panel-item-title">
                          {entry.domains.slice(0, 3).join(", ")}
                          {entry.domains.length > 3 && ` +${entry.domains.length - 3}`}
                        </span>
                        <span className="side-panel-item-meta">
                          <span className="side-panel-badge side-panel-badge--available">{entry.availableCount}</span>
                          <span className="side-panel-badge side-panel-badge--taken">{entry.takenCount}</span>
                          <span className="side-panel-badge side-panel-badge--error">{entry.errorCount}</span>
                          <span className="side-panel-item-time">
                            {formatTimestamp(entry.timestamp, i18n.language)}
                          </span>
                        </span>
                      </div>
                      <button
                        className="side-panel-item-delete"
                        onClick={() => void handleDeleteHistory(entry.id)}
                        aria-label={t("history.delete")}
                        title={t("history.delete")}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === "saved" && (
            <div className="side-panel-list">
              {sessions.length === 0 ? (
                <p className="side-panel-empty">{t("sessions.empty")}</p>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="side-panel-item">
                    <div
                      className="side-panel-item-main"
                      role="button"
                      tabIndex={0}
                      onClick={() => { onLoadSession(session); onClose(); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onLoadSession(session);
                          onClose();
                        }
                      }}
                    >
                      {renamingId === session.id ? (
                        <input
                          ref={renameInputRef}
                          className="side-panel-rename-input"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => void commitRename(session.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitRename(session.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="side-panel-item-title"
                          onDoubleClick={(e) => { e.stopPropagation(); startRename(session); }}
                          title={t("sessions.doubleClickToRename")}
                        >
                          {session.name}
                        </span>
                      )}
                      <span className="side-panel-item-meta">
                        <span className="side-panel-item-count">
                          {t("sessions.domainCount", { count: session.domains.length })}
                        </span>
                        <span className="side-panel-item-time">
                          {formatTimestamp(session.createdAt, i18n.language)}
                        </span>
                      </span>
                    </div>
                    <div className="side-panel-item-actions">
                      <button
                        className="side-panel-item-action"
                        onClick={(e) => { e.stopPropagation(); startRename(session); }}
                        aria-label={t("sessions.rename")}
                        title={t("sessions.rename")}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M8 1.5l2.5 2.5-7 7H1V8.5l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        className="side-panel-item-delete"
                        onClick={() => void handleDeleteSession(session.id)}
                        aria-label={t("sessions.delete")}
                        title={t("sessions.delete")}
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
          )}
        </div>
      </div>
    </>
  );
}
