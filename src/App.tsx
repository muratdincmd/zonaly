import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DomainInput } from "./components/DomainInput";
import {
  ExtensionPicker,
  TLDS_ALL,
  TLDS_DEFAULT,
} from "./components/ExtensionPicker";
import { ResultsList } from "./components/ResultsList";
import { ThemeToggle } from "./components/ThemeToggle";
import { useDomainCheck } from "./hooks/useDomainCheck";
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

  const toggleTld = (tld: string) => {
    setSelectedTlds((prev) => {
      const next = new Set(prev);
      if (next.has(tld)) {
        next.delete(tld);
      } else {
        next.add(tld);
      }
      return next;
    });
  };

  const handleCheck = () => {
    const names = parseInput(inputText);
    const tlds = TLDS_ALL.filter((tld) => selectedTlds.has(tld));
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
    !isChecking && parseInput(inputText).length > 0 && selectedTlds.size > 0;

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t("app.title")}</h1>
        <ThemeToggle />
      </header>
      <main className="app-main">
        <DomainInput value={inputText} onChange={setInputText} />
        <ExtensionPicker selected={selectedTlds} onToggle={toggleTld} />
        <button
          type="button"
          className="check-btn"
          disabled={!canCheck}
          onClick={handleCheck}
        >
          {isChecking ? t("check.loading") : t("check.button")}
        </button>
        <ResultsList results={orderedResults} />
      </main>
    </div>
  );
}

export default App;
