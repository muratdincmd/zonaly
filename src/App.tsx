import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { AppFooter } from "./components/AppFooter";
import { AppLogo } from "./components/AppLogo";
import { DomainDetailsModal } from "./components/DomainDetailsModal";
import { DomainInput } from "./components/DomainInput";
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
import { TabsProvider, useTabs } from "./context/TabsContext";
import { useScale } from "./hooks/useScale";
import { useToast } from "./hooks/useToast";
import type { DomainQuery, DomainResult } from "./types/domain";
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
// Keyed by tab id so React fully remounts state when switching tabs.

function TabPanel({ tabId }: { tabId: string }) {
  const { t } = useTranslation();
  const { tabs, dispatch } = useTabs();
  const tab = tabs.find((t) => t.id === tabId)!;
  const { toast, show: showToast, dismiss: dismissToast } = useToast(3000);
  const [detailsFor, setDetailsFor] = useState<DomainResult | null>(null);

  // Track the active check so we can cancel listeners on unmount
  const checkRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    return () => { checkRef.current?.cancel(); };
  }, []);

  const handleInputChange = (value: string, sanitized: boolean) => {
    dispatch({ type: "UPDATE_INPUT", id: tabId, value });
    if (sanitized) showToast(t("input.sanitized"));
  };

  const toggleTld = (tld: string) =>
    dispatch({ type: "TOGGLE_TLD", id: tabId, tld });

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

    // Build tab title from domain names
    const MAX_SHOWN = 3;
    const extra = names.length > MAX_SHOWN ? ` +${names.length - MAX_SHOWN}` : "";
    const title = names.slice(0, MAX_SHOWN).join(", ") + extra;
    dispatch({ type: "SET_TITLE", id: tabId, title });
    dispatch({ type: "SET_SUBMITTED", id: tabId, queries });
    dispatch({ type: "CLEAR_RESULTS", id: tabId });
    dispatch({ type: "SET_CHECKING", id: tabId, value: true });

    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    checkRef.current = {
      cancel: () => {
        cancelled = true;
        unlisteners.forEach((u) => u());
      },
    };

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

  const orderedResults: DomainResult[] = tab.submittedQueries
    .map((q) => tab.results.get(`${q.name}.${q.tld}`))
    .filter((r): r is DomainResult => r !== undefined);

  const canCheck =
    !tab.isChecking &&
    parseInput(tab.inputText).length > 0 &&
    [...tab.selectedTlds].some((tld) => !TLDS_NO_RDAP.has(tld));

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
          <button
            type="button"
            className="check-btn"
            disabled={!canCheck}
            onClick={() => void handleCheck()}
          >
            {tab.isChecking ? t("check.loading") : t("check.button")}
          </button>
          <ResultsList results={orderedResults} onRowClick={setDetailsFor} />
        </div>
      </main>

      <Toast toast={toast} onDismiss={dismissToast} />

      {detailsFor && (
        <DomainDetailsModal
          domain={detailsFor}
          onClose={() => setDetailsFor(null)}
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

      // Ctrl+T — new tab
      if (e.key === "t") {
        e.preventDefault();
        addTab();
        return;
      }

      // Ctrl+W — close active tab
      if (e.key === "w") {
        e.preventDefault();
        closeTab(activeId);
        return;
      }

      // Ctrl+Tab — next tab
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeId);
        const next = tabs[(idx + 1) % tabs.length];
        activateTab(next.id);
        return;
      }

      // Ctrl+Shift+Tab — previous tab
      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeId);
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
        activateTab(prev.id);
        return;
      }

      // Ctrl+1..9 — switch to tab by number
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
  useScale();

  return (
    <div className={`app${useCustomTitleBar ? " app--custom-titlebar" : ""}`}>
      <KeyboardShortcuts />

      {/* Custom title bar on Windows (includes TabBar); native header elsewhere */}
      {useCustomTitleBar ? (
        <TitleBar />
      ) : (
        <header className="app-header">
          <AppLogo />
          <div className="header-controls">
            <LanguageSelector />
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* key= ensures full remount when switching tabs → clean isolated state */}
      <TabPanel key={activeId} tabId={activeId} />

      {/* Sticky footer — never scales */}
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
