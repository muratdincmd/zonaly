import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";

import type { DomainResult } from "../types/domain";
import type { ExportResult } from "../types/storage";

import { ResultRow } from "./ResultRow";

interface Props {
  results: DomainResult[];
  onRowClick?: (result: DomainResult) => void;
  watchedIds?: Map<string, number>;
  onWatchlistChange?: () => void;
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsList({ results, onRowClick, watchedIds, onWatchlistChange }: Props) {
  const { t } = useTranslation();

  if (results.length === 0) {
    return <p className="empty">{t("results.empty")}</p>;
  }

  const available = results.filter((r) => r.status.kind === "available");
  const taken = results.filter((r) => r.status.kind === "taken");
  const errors = results.filter((r) => r.status.kind === "error");

  const handleExport = async (format: "csv" | "json") => {
    const exportData: ExportResult[] = results.map((r) => ({
      name: r.name,
      tld: r.tld,
      status: r.status.kind,
    }));
    try {
      const content = await invoke<string>("export_results", {
        results: exportData,
        format,
      });
      const ext = format === "csv" ? "csv" : "json";
      triggerDownload(content, `zonaly-results.${ext}`);
    } catch (e) {
      console.error("export failed", e);
    }
  };

  return (
    <div className="results">
      {available.length > 0 && (
        <section className="group">
          <h2 className="group-title">
            {t("results.available")} ({available.length})
          </h2>
          <div className="group-rows">
            {available.map((r) => (
              <ResultRow
                key={`${r.name}.${r.tld}`}
                result={r}
                watchedIds={watchedIds}
                onWatchlistChange={onWatchlistChange}
              />
            ))}
          </div>
        </section>
      )}
      {taken.length > 0 && (
        <section className="group">
          <h2 className="group-title">
            {t("results.taken")} ({taken.length})
          </h2>
          <div className="group-rows">
            {taken.map((r) => (
              <ResultRow
                key={`${r.name}.${r.tld}`}
                result={r}
                onClick={onRowClick}
                watchedIds={watchedIds}
                onWatchlistChange={onWatchlistChange}
              />
            ))}
          </div>
        </section>
      )}
      {errors.length > 0 && (
        <section className="group">
          <h2 className="group-title">
            {t("results.error")} ({errors.length})
          </h2>
          <div className="group-rows">
            {errors.map((r) => (
              <ResultRow key={`${r.name}.${r.tld}`} result={r} />
            ))}
          </div>
        </section>
      )}

      {/* Export bar — shown after results so it doesn't dominate the view */}
      <div className="results-toolbar">
        <span className="results-toolbar-label">{t("export.button")}</span>
        <button
          type="button"
          className="export-btn"
          onClick={() => void handleExport("csv")}
          title={t("export.csv")}
        >
          {t("export.csv")}
        </button>
        <button
          type="button"
          className="export-btn"
          onClick={() => void handleExport("json")}
          title={t("export.json")}
        >
          {t("export.json")}
        </button>
      </div>
    </div>
  );
}
