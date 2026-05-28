import { useState } from "react";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type { DomainQuery, DomainResult } from "../types/domain";

export function useDomainCheck() {
  const [results, setResults] = useState<Map<string, DomainResult>>(new Map());
  const [isChecking, setIsChecking] = useState(false);

  const run = async (queries: DomainQuery[]) => {
    if (queries.length === 0) return;

    setResults(new Map());
    setIsChecking(true);

    const unlistenResult = await listen<DomainResult>(
      "domain-result",
      (event) => {
        const r = event.payload;
        setResults((prev) => {
          const next = new Map(prev);
          next.set(`${r.name}.${r.tld}`, r);
          return next;
        });
      },
    );

    const unlistenComplete = await listen("domain-results-complete", () => {
      setIsChecking(false);
      unlistenResult();
      unlistenComplete();
    });

    try {
      await invoke("check_domains", { queries });
    } catch (e) {
      console.error("check_domains failed", e);
      setIsChecking(false);
      unlistenResult();
      unlistenComplete();
    }
  };

  return { results, isChecking, run };
}
