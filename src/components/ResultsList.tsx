import { useTranslation } from "react-i18next";

import type { DomainResult } from "../types/domain";

import { ResultRow } from "./ResultRow";

interface Props {
  results: DomainResult[];
  onRowClick?: (result: DomainResult) => void;
}

export function ResultsList({ results, onRowClick }: Props) {
  const { t } = useTranslation();

  if (results.length === 0) {
    return <p className="empty">{t("results.empty")}</p>;
  }

  const available = results.filter((r) => r.status.kind === "available");
  const taken = results.filter((r) => r.status.kind === "taken");
  const errors = results.filter((r) => r.status.kind === "error");

  return (
    <div className="results">
      {available.length > 0 && (
        <section className="group">
          <h2 className="group-title">
            {t("results.available")} ({available.length})
          </h2>
          <div className="group-rows">
            {available.map((r) => (
              <ResultRow key={`${r.name}.${r.tld}`} result={r} />
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
    </div>
  );
}
