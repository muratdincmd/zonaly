import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";

import type { DomainResult } from "../types/domain";

interface Props {
  result: DomainResult;
  onClick?: (result: DomainResult) => void;
}

function openExternal(url: string) {
  void invoke("open_url", { url });
}

/** Map Rust error codes (e.g. "err:no_protocol|.fr") to translated strings. */
function translateError(msg: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!msg.startsWith("err:")) return msg;
  const [code, ctx] = msg.slice(4).split("|");
  switch (code) {
    case "no_protocol": return t("results.errors.no_protocol", { tld: ctx ?? "" });
    case "timeout":     return t("results.errors.timeout");
    case "rate_limited":return t("results.errors.rate_limited");
    case "http":        return t("results.errors.http", { code: ctx ?? "" });
    case "network":     return t("results.errors.network");
    case "parse":       return t("results.errors.parse");
    default:            return msg;
  }
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
        <span className="error-msg">{translateError(result.status.message, t)}</span>
      )}
      {kind === "taken" && (
        <button
          type="button"
          className="row-external-link"
          onClick={(e) => {
            e.stopPropagation();
            openExternal(`https://${result.name}.${result.tld}`);
          }}
          aria-label={`Visit ${result.name}.${result.tld}`}
          title={`https://${result.name}.${result.tld}`}
          tabIndex={-1}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
            />
            <path
              d="M8 1h3m0 0v3m0-3L5.5 6.5"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
