import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { AppFooter } from "./components/AppFooter";
import { AppLogo } from "./components/AppLogo";
import { DomainDetailsModal } from "./components/DomainDetailsModal";
import { DomainInput } from "./components/DomainInput";
import { HistoryPanel } from "./components/HistoryPanel";
import { LanguageSelector } from "./components/LanguageSelector";
import {
  ExtensionPicker,
  TLDS_ALL,
  TLDS_NO_RDAP,
} from "./components/ExtensionPicker";
import { ResultsList } from "./components/ResultsList";
import { ThemeToggle } from "./components/ThemeToggle";
import { TitleBar } from "./components/TitleBar";
import { Toast } from "./components/Toast";
import { WatchlistPanel } from "./components/WatchlistPanel";
import { TabsProvider, useTabs } from "./context/TabsContext";
import { useScale } from "./hooks/useScale";
import { useToast } from "./hooks/useToast";
import type { DomainQuery, DomainResult } from "./types/domain";
import type { HistoryEntry, SavedSession, WatchlistEntry } from "./types/storage";
import { useCustomTitleBar } from "./utils/platform";

const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function parseInput(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const name = line.trim().toLowerCase();
    if (name && !seen.has(name) && DOMAIN_RE.test(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

// ── Per-tab content panel ─────────────────────────────────────────────────────

interface TabPanelProps {
  tabId: string;
  onOpenHistory: () => void;
  onOpenWatchlist: () => void;
  // Called from AppShell when a history entry or session is loaded
  restoreRef: React.MutableRefObject<((entry: HistoryEntry) => void) | null>;
  loadSessionRef: React.MutableRefObject<((session: SavedSession) => void) | null>;
}

function TabPanel({ tabId, onOpenHistory, onOpenWatchlist, restoreRef, loadSessionRef }: TabPanelProps) {
  const { t } = useTranslation();
  const { tabs, dispatch } = useTabs();
  const tab = tabs.find((t) => t.id === tabId)!;
  const { toast, show: showToast, dismiss: dismissToast } = useToast(3000);
  const [detailsFor, setDetailsFor] = useState<DomainResult | null>(null);
  const [watchedIds, setWatchedIds] = useState<Map<string, number>>(new Map());

  const loadWatchlist = useCallback(() => {
    invoke<WatchlistEntry[]>("get_watchlist")
      .then((entries) => {
        const m = new Map<string, number>();
        for (const e of entries) m.set(`${e.domain}.${e.tld}`, e.id);
        setWatchedIds(m);
      })
      .catch(console.error);
  }, []);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

  // Register callbacks so AppShell can restore/load into the active tab
  const handleRestoreHistory = useCallback((entry: HistoryEntry) => {
    dispatch({ type: "UPDATE_INPUT", id: tabId, value: entry.domains.join("\n") });
    dispatch({ type: "BULK_TOGGLE_TLD", id: tabId, tlds: TLDS_ALL, select: false });
    dispatch({ type: "BULK_TOGGLE_TLD", id: tabId, tlds: entry.tldList, select: true });
  }, [tabId, dispatch]);

  const handleLoadSession = useCallback((session: SavedSession) => {
    dispatch({ type: "UPDATE_INPUT", id: tabId, value: session.domains.join("\n") });
    dispatch({ type: "BULK_TOGGLE_TLD", id: tabId, tlds: TLDS_ALL, select: false });
    dispatch({ type: "BULK_TOGGLE_TLD", id: tabId, tlds: session.tldList, select: true });
  }, [tabId, dispatch]);

  // Register callbacks on every render (stable because useCallback)
  restoreRef.current = handleRestoreHistory;
  loadSessionRef.current = handleLoadSession;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restoreRef.current === handleRestoreHistory) restoreRef.current = null;
      if (loadSessionRef.current === handleLoadSession) loadSessionRef.current = null;
    };
  }, [handleRestoreHistory, handleLoadSession, restoreRef, loadSessionRef]);

  // Track the active check so we can cancel listeners on unmount
  const checkRef = useRef<{ cancel: () => void } | null>(null);
  useEffect(() => { return () => { checkRef.current?.cancel(); }; }, []);

  const handleInputChange = (value: string, sanitized: boolean) => {
    dispatch({ type: "UPDATE_INPUT", id: tabId, value });
    if (sanitized) showToast(t("input.sanitized"));
  };

  const toggleTld = (tld: string) => dispatch({ type: "TOGGLE_TLD", id: tabId, tld });
  const bulkToggle = (tlds: string[], select: boolean) =>
    dispatch({ type: "BULK_TOGGLE_TLD", id: tabId, tlds, select });

  const handleCheck = async () => {
    const names = parseInput(tab.inputText);
    const tlds = TLDS_ALL.filter(
      (tld) => tab.selectedTlds.has(tld) && !TLDS_NO_RDAP.has(tld),
    );
    const queries: DomainQuery[] = names.flatMap((name) =>
      tlds.map((tld) => ({ name, tld })),
    );
    if (queries.length === 0) return;

    const MAX_SHOWN = 3;
    const extra = names.length > MAX_SHOWN ? ` +${names.length - MAX_SHOWN}` : "";
    const title = names.slice(0, MAX_SHOWN).join(", ") + extra;
    dispatch({ type: "SET_TITLE", id: tabId, title });
    dispatch({ type: "SET_SUBMITTED", id: tabId, queries });
    dispatch({ type: "CLEAR_RESULTS", id: tabId });
    dispatch({ type: "SET_CHECKING", id: tabId, value: true });

    let cancelled = false;
    const unlisteners: Array<() => void> = [];
    checkRef.current = { cancel: () => { cancelled = true; unlisteners.forEach((u) => u()); } };

    const unlistenResult = await listen<DomainResult>("domain-result", (event) => {
      if (cancelled) return;
      dispatch({ type: "ADD_RESULT", id: tabId, result: event.payload });
    });
    unlisteners.push(unlistenResult);

    const unlistenComplete = await listen("domain-results-complete", () => {
      if (cancelled) return;
      dispatch({ type: "SET_CHECKING", id: tabId, value: false });
      unlisteners.forEach((u) => u());
    });
    unlisteners.push(unlistenComplete);

    try {
      await invoke("check_domains", { queries });
    } catch (e) {
      console.error("check_domains failed", e);
      if (!cancelled) {
        dispatch({ type: "SET_CHECKING", id: tabId, value: false });
        unlisteners.forEach((u) => u());
      }
    }
  };

  const handleSaveSession = async () => {
    const names = parseInput(tab.inputText);
    if (names.length === 0) return;
    const name = names.slice(0, 2).join(", ");
    const tlds = TLDS_ALL.filter((tld) => tab.selectedTlds.has(tld));
    try {
      await invoke("save_session", { name, domains: names, tlds });
      showToast(t("sessions.saved"));
    } catch (e) {
      console.error("save session failed", e);
    }
  };

  const orderedResults: DomainResult[] = tab.submittedQueries
    .map((q) => tab.results.get(`${q.name}.${q.tld}`))
    .filter((r): r is DomainResult => r !== undefined);

  const canCheck =
    !tab.isChecking &&
    parseInput(tab.inputText).length > 0 &&
    [...tab.selectedTlds].some((tld) => !TLDS_NO_RDAP.has(tld));

  const canSave = parseInput(tab.inputText).length > 0;

  const exportCallbacks = {
    onSuccess: (label: string) => {
      showToast(t("export.success", { label }), {
        variant: "info" as const,
        duration: 5000,
        onClickAction: () => { void invoke("open_downloads_folder"); },
      });
    },
    onError: (reason: string) => {
      showToast(`${t("export.error")}: ${reason}`, {
        variant: "error" as const,
        duration: 4000,
      });
    },
  };

  return (
    <>
      <main className="app-main">
        <div className="app-main-inner">
          <DomainInput value={tab.inputText} onChange={handleInputChange} />
          <ExtensionPicker
            selected={tab.selectedTlds}
            onToggle={toggleTld}
            onBulkToggle={bulkToggle}
          />
          <div className="check-row">
            <button
              type="button"
              className="check-btn"
              disabled={!canCheck}
              onClick={() => void handleCheck()}
            >
              {tab.isChecking ? t("check.loading") : t("check.button")}
            </button>
            <button
              type="button"
              className="save-session-btn"
              disabled={!canSave}
              onClick={() => void handleSaveSession()}
              title={t("sessions.save")}
              aria-label={t("sessions.save")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4 1v4h6V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3.5" y="7" width="7" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
            </button>
            <button
              type="button"
              className="panel-icon-btn"
              onClick={onOpenHistory}
              title={t("history.panelTitle")}
              aria-label={t("history.panelTitle")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M7 4v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              type="button"
              className="panel-icon-btn"
              onClick={onOpenWatchlist}
              title={t("watchlist.panelTitle")}
              aria-label={t("watchlist.panelTitle")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 1.5h8a.5.5 0 01.5.5v11l-4.5-2.5L2.5 13V2a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <ResultsList
            results={orderedResults}
            onRowClick={setDetailsFor}
            watchedIds={watchedIds}
            onWatchlistChange={loadWatchlist}
            exportCallbacks={exportCallbacks}
          />
        </div>
      </main>

      <Toast toast={toast} onDismiss={dismissToast} />

      {detailsFor && (
        <DomainDetailsModal
          domain={detailsFor}
          onClose={() => setDetailsFor(null)}
          exportCallbacks={exportCallbacks}
        />
      )}
    </>
  );
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

function KeyboardShortcuts() {
  const { tabs, activeId, addTab, closeTab, activateTab } = useTabs();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key === "t") { e.preventDefault(); addTab(); return; }
      if (e.key === "w") { e.preventDefault(); closeTab(activeId); return; }

      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeId);
        activateTab(tabs[(idx + 1) % tabs.length].id);
        return;
      }

      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeId);
        activateTab(tabs[(idx - 1 + tabs.length) % tabs.length].id);
        return;
      }

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        e.preventDefault();
        const target = tabs[num - 1];
        if (target) activateTab(target.id);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tabs, activeId, addTab, closeTab, activateTab]);

  return null;
}

// ── Root app shell ────────────────────────────────────────────────────────────

function AppShell() {
  const { activeId } = useTabs();
  const { t } = useTranslation();
  useScale();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);

  // Refs to active tab's restore/load handlers
  const restoreRef = useRef<((entry: HistoryEntry) => void) | null>(null);
  const loadSessionRef = useRef<((session: SavedSession) => void) | null>(null);

  const openHistory = useCallback(() => { setHistoryOpen(true); setWatchlistOpen(false); }, []);
  const openWatchlist = useCallback(() => { setWatchlistOpen(true); setHistoryOpen(false); }, []);

  return (
    <div className={`app${useCustomTitleBar ? " app--custom-titlebar" : ""}`}>
      <KeyboardShortcuts />

      {useCustomTitleBar ? (
        <TitleBar
          onOpenHistory={openHistory}
          onOpenWatchlist={openWatchlist}
        />
      ) : (
        <header className="app-header">
          <AppLogo />
          <div className="header-controls">
            <button
              type="button"
              className="panel-icon-btn"
              onClick={openHistory}
              title={t("history.panelTitle")}
              aria-label={t("history.panelTitle")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M7 4v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              type="button"
              className="panel-icon-btn"
              onClick={openWatchlist}
              title={t("watchlist.panelTitle")}
              aria-label={t("watchlist.panelTitle")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 1.5h8a.5.5 0 01.5.5v11l-4.5-2.5L2.5 13V2a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <LanguageSelector />
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* key= ensures full remount when switching tabs */}
      <TabPanel
        key={activeId}
        tabId={activeId}
        onOpenHistory={openHistory}
        onOpenWatchlist={openWatchlist}
        restoreRef={restoreRef}
        loadSessionRef={loadSessionRef}
      />

      {/* Panels — rendered at AppShell level so they overlay everything */}
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestoreHistory={(entry) => { restoreRef.current?.(entry); setHistoryOpen(false); }}
        onLoadSession={(session) => { loadSessionRef.current?.(session); setHistoryOpen(false); }}
      />
      <WatchlistPanel
        open={watchlistOpen}
        onClose={() => setWatchlistOpen(false)}
      />

      <AppFooter />
    </div>
  );
}

export default function App() {
  return (
    <TabsProvider>
      <AppShell />
    </TabsProvider>
  );
}
