import { useTranslation } from "react-i18next";

import type { DomainResult } from "../types/domain";

interface Props {
  result: DomainResult;
  onClick?: (result: DomainResult) => void;
}

export function ResultRow({ result, onClick }: Props) {
  const { t } = useTranslation();
  const kind = result.status.kind;
  const clickable = kind === "taken" && !!onClick;

  return (
    <div
      className={`row row-${kind}`}
      onClick={clickable ? () => onClick(result) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(result);
              }
            }
          : undefined
      }
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <span className={`dot dot-${kind}`} />
      <span className="domain">
        <span className="domain-name">{result.name}</span>
        <span className="domain-tld">.{result.tld}</span>
      </span>
      {kind === "available" && (
        <span className="result-badge result-badge-available">
          {t("results.availableBadge")}
        </span>
      )}
      {kind === "error" && (
        <span className="error-msg">{result.status.message}</span>
      )}
    </div>
  );
}
