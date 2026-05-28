import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppFooter } from "./components/AppFooter";
import { AppLogo } from "./components/AppLogo";
import { DomainInput } from "./components/DomainInput";
import { LanguageSelector } from "./components/LanguageSelector";
import {
  ExtensionPicker,
  TLDS_ALL,
  TLDS_DEFAULT,
  TLDS_NO_RDAP,
} from "./components/ExtensionPicker";
import { ResultsList } from "./components/ResultsList";
import { ThemeToggle } from "./components/ThemeToggle";
import { Toast } from "./components/Toast";
import { useDomainCheck } from "./hooks/useDomainCheck";
import { useScale } from "./hooks/useScale";
import { useToast } from "./hooks/useToast";
import type { DomainQuery, DomainResult } from "./types/domain";

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

function App() {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState("");
  const [selectedTlds, setSelectedTlds] = useState<Set<string>>(
    () => new Set(TLDS_DEFAULT),
  );
  const [submittedQueries, setSubmittedQueries] = useState<DomainQuery[]>([]);
  const { results, isChecking, run } = useDomainCheck();
  const { toast, show: showToast, dismiss: dismissToast } = useToast(3000);
  useScale();

  const handleInputChange = (value: string, sanitized: boolean) => {
    setInputText(value);
    if (sanitized) showToast(t("input.sanitized"));
  };

  const toggleTld = (tld: string) => {
    setSelectedTlds((prev) => {
      const next = new Set(prev);
      if (next.has(tld)) next.delete(tld);
      else next.add(tld);
      return next;
    });
  };

  const bulkToggle = (tlds: string[], select: boolean) => {
    setSelectedTlds((prev) => {
      const next = new Set(prev);
      for (const tld of tlds) {
        if (select) next.add(tld);
        else next.delete(tld);
      }
      return next;
    });
  };

  const handleCheck = () => {
    const names = parseInput(inputText);
    const tlds = TLDS_ALL.filter(
      (tld) => selectedTlds.has(tld) && !TLDS_NO_RDAP.has(tld),
    );
    const queries: DomainQuery[] = names.flatMap((name) =>
      tlds.map((tld) => ({ name, tld })),
    );
    setSubmittedQueries(queries);
    void run(queries);
  };

  const orderedResults: DomainResult[] = submittedQueries
    .map((q) => results.get(`${q.name}.${q.tld}`))
    .filter((r): r is DomainResult => r !== undefined);

  const canCheck =
    !isChecking &&
    parseInput(inputText).length > 0 &&
    [...selectedTlds].some((tld) => !TLDS_NO_RDAP.has(tld));

  return (
    <div className="app">
      {/* Sticky header — never scales */}
      <header className="app-header">
        <AppLogo />
        <div className="header-controls">
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </header>

      {/* Scrollable content — only this area scales */}
      <main className="app-main">
        <div className="app-main-inner">
          <DomainInput value={inputText} onChange={handleInputChange} />
          <ExtensionPicker
            selected={selectedTlds}
            onToggle={toggleTld}
            onBulkToggle={bulkToggle}
          />
          <button
            type="button"
            className="check-btn"
            disabled={!canCheck}
            onClick={handleCheck}
          >
            {isChecking ? t("check.loading") : t("check.button")}
          </button>
          <ResultsList results={orderedResults} />
        </div>
      </main>

      {/* Sticky footer — never scales */}
      <AppFooter />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
