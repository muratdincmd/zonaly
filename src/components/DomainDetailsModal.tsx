import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";

import type { DomainDetails, DomainResult } from "../types/domain";
import type { WatchlistEntry } from "../types/storage";

interface ExportCallbacks {
  onSuccess: (label: string) => void;
  onError: (reason: string) => void;
}

interface Props {
  domain: DomainResult;
  onClose: () => void;
  exportCallbacks?: ExportCallbacks;
  onWatchlistChange?: () => void;
}

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; details: DomainDetails }
  | { kind: "error"; message: string };

export function DomainDetailsModal({ domain, onClose, exportCallbacks, onWatchlistChange }: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [watchlistId, setWatchlistId] = useState<number | null>(null);
  const [watchlistToggling, setWatchlistToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    invoke<DomainDetails>("fetch_domain_details", {
      name: domain.name,
      tld: domain.tld,
    })
      .then((details) => {
        if (!cancelled) setState({ kind: "ok", details });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: typeof e === "string" ? e : String(e),
          });
        }
      });
    return () => { cancelled = true; };
  }, [domain.name, domain.tld]);

  // Check if this domain is already in the watchlist
  useEffect(() => {
    invoke<WatchlistEntry[]>("get_watchlist")
      .then((entries) => {
        const found = entries.find(
          (e) => e.domain === domain.name && e.tld === domain.tld
        );
        setWatchlistId(found ? found.id : null);
      })
      .catch(() => {});
  }, [domain.name, domain.tld]);

  const handleWatchlistToggle = async () => {
    setWatchlistToggling(true);
    try {
      if (watchlistId !== null) {
        await invoke("remove_from_watchlist", { id: watchlistId });
        setWatchlistId(null);
      } else {
        const entry = await invoke<WatchlistEntry>("add_to_watchlist", {
          domain: domain.name,
          tld: domain.tld,
        });
        setWatchlistId(entry.id);
      }
      onWatchlistChange?.();
    } catch (e) {
      console.error("watchlist toggle failed", e);
    } finally {
      setWatchlistToggling(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <header className="modal-header">
          <div className="modal-title-block">
            <h2 className="modal-domain">
              <span className="modal-domain-name">{domain.name}</span>
              <span className="modal-domain-tld">.{domain.tld}</span>
            </h2>
            <SourceBadge source={state.kind === "ok" ? state.details.source : undefined} />
            {state.kind === "ok" && isExpiredDate(state.details.expires) && (
              <span className="modal-expired-badge">{t("details.expired")}</span>
            )}
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={t("details.close")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        <div className="modal-body">
          {state.kind === "loading" && (
            <p className="modal-loading">{t("details.loading")}</p>
          )}
          {state.kind === "error" && (
            <p className="modal-error">
              {t("details.error")}: {state.message}
            </p>
          )}
          {state.kind === "ok" && (
            <DetailsContent details={state.details} />
          )}
        </div>

        {/* Footer — export on left, watchlist icon on right */}
        {state.kind === "ok" && (
          <div className="modal-footer">
            <span className="results-toolbar-label">{t("export.button")}</span>
            <button
              type="button"
              className="export-btn"
              onClick={() => void handleExport(state.details, "csv")}
            >
              {t("export.csv")}
            </button>
            <button
              type="button"
              className="export-btn"
              onClick={() => void handleExport(state.details, "json")}
            >
              {t("export.json")}
            </button>

            {/* Spacer */}
            <span style={{ flex: 1 }} />

            {/* Watchlist icon-only button — right side */}
            <button
              type="button"
              className={`modal-watchlist-btn${watchlistId !== null ? " modal-watchlist-btn--active" : ""}`}
              onClick={() => void handleWatchlistToggle()}
              disabled={watchlistToggling}
              aria-label={watchlistId !== null ? t("watchlist.remove") : t("watchlist.add")}
              title={watchlistId !== null ? t("watchlist.remove") : t("watchlist.add")}
            >
              <svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden="true">
                {watchlistId !== null ? (
                  <path
                    d="M2 1.5h9a.5.5 0 01.5.5v10.5l-5-2.8-5 2.8V2a.5.5 0 01.5-.5z"
                    fill="currentColor" stroke="currentColor" strokeWidth="1.1"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M2 1.5h9a.5.5 0 01.5.5v10.5l-5-2.8-5 2.8V2a.5.5 0 01.5-.5z"
                    stroke="currentColor" strokeWidth="1.1"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                )}
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  async function handleExport(details: DomainDetails, format: "csv" | "json") {
    // Proposed filename — browser may append (1), (2) etc. if it already exists.
    // We show this as the label; user sees e.g. "abdiss-com.CSV"
    const filename = `${details.name}-${details.tld}.${format}`;
    const rows = [{
      name: details.name,
      tld: details.tld,
      status: "taken",
      registrar: details.registrar ?? "",
      registered: details.registered ?? "",
      expires: details.expires ?? "",
      updated: details.updated ?? "",
      nameservers: details.nameservers.join("; "),
      statuses: details.statuses.join("; "),
    }];

    try {
      let content: string;
      if (format === "json") {
        content = JSON.stringify(rows, null, 2);
      } else {
        const headers = Object.keys(rows[0]).join(",");
        const line = Object.values(rows[0])
          .map((v) => (String(v).includes(",") || String(v).includes('"') ? `"${String(v).replace(/"/g, '""')}"` : String(v)))
          .join(",");
        content = `${headers}\n${line}\n`;
      }

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      exportCallbacks?.onSuccess(filename);
    } catch (e) {
      exportCallbacks?.onError(String(e));
    }
  }
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source?: "rdap" | "whois" }) {
  const { t } = useTranslation();
  if (!source) return null;
  return (
    <span className={`modal-source modal-source-${source}`}>
      {t(`details.source.${source}`)}
    </span>
  );
}

// ── Body content ──────────────────────────────────────────────────────────────

function DetailsContent({ details }: { details: DomainDetails }) {
  const { t } = useTranslation();

  const hasAnyField =
    details.registrar ||
    details.registered ||
    details.expires ||
    details.updated ||
    details.nameservers.length > 0 ||
    details.statuses.length > 0;

  if (!hasAnyField) {
    return <p className="modal-empty">{t("details.limited")}</p>;
  }

  return (
    <dl className="modal-grid">
      {details.registrar && (
        <>
          <dt className="modal-label">{t("details.registrar")}</dt>
          <dd className="modal-value modal-registrar-row">
            <span>{details.registrar}</span>
            <button
              type="button"
              className="modal-registrar-link"
              onClick={() => void invoke("open_url", {
                url: `https://lookup.icann.org/en/lookup?name=${details.name}.${details.tld}`,
              })}
              aria-label="ICANN Lookup"
              title={`ICANN Lookup: ${details.name}.${details.tld}`}
            >
              <svg width="11" height="11" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M4 2H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6.5 1h2.5m0 0v2.5m0-2.5L5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </dd>
        </>
      )}

      {details.registered && (
        <>
          <Field label={t("details.registered")} value={formatDate(details.registered)} />
          <DomainAge registered={details.registered} />
        </>
      )}

      {details.expires && (
        <ExpiryField isoDate={details.expires} />
      )}

      {details.updated && (
        <Field label={t("details.updated")} value={formatDate(details.updated)} />
      )}

      {details.nameservers.length > 0 && (
        <>
          <dt className="modal-label">{t("details.nameservers")}</dt>
          <dd className="modal-value modal-list">
            {details.nameservers.map((ns) => (
              <NameserverPill key={ns} ns={ns} />
            ))}
          </dd>
        </>
      )}

      {details.statuses.length > 0 && (
        <>
          <dt className="modal-label">{t("details.statuses")}</dt>
          <dd className="modal-value modal-list">
            {details.statuses.map((s) => (
              <span key={s} className="modal-status-pill" title={s}>
                {humanizeStatus(s, t)}
              </span>
            ))}
          </dd>
        </>
      )}
    </dl>
  );
}

// ── Expiry row with days-remaining badge ──────────────────────────────────────

function ExpiryField({ isoDate }: { isoDate: string }) {
  const { t } = useTranslation();
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) {
    return <Field label={t("details.expires")} value={isoDate} />;
  }

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let urgency: "ok" | "warn" | "urgent" | "expired";
  if (daysLeft < 0) urgency = "expired";
  else if (daysLeft < 30) urgency = "urgent";
  else if (daysLeft <= 90) urgency = "warn";
  else urgency = "ok";

  const badge =
    urgency === "expired"
      ? t("details.expired")
      : t("details.daysLeft", { count: daysLeft });

  return (
    <>
      <dt className="modal-label">{t("details.expires")}</dt>
      <dd className="modal-value modal-expiry-row">
        <span>{formatDate(isoDate)}</span>
        <span className={`modal-expiry-badge modal-expiry-${urgency}`}>
          {badge}
        </span>
      </dd>
    </>
  );
}

// ── Domain age row ────────────────────────────────────────────────────────────

function DomainAge({ registered }: { registered: string }) {
  const { t } = useTranslation();
  const d = new Date(registered);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (months < 0) { years -= 1; months += 12; }

  const age =
    months === 0
      ? t("details.ageYears", { count: years })
      : t("details.ageYearsMonths", { years, months });

  return <Field label={t("details.age")} value={age} />;
}

// ── Nameserver pill with copy button ─────────────────────────────────────────

function NameserverPill({ ns }: { ns: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ns);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access may fail silently
    }
  };

  return (
    <span className="modal-ns-pill">
      <code className="modal-ns">{ns}</code>
      <button
        type="button"
        className={`modal-ns-copy${copied ? " modal-ns-copy--done" : ""}`}
        onClick={handleCopy}
        aria-label={t("details.copyNameserver")}
        title={t("details.copyNameserver")}
      >
        {copied ? (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <polyline points="1.5,5.5 4.5,8.5 9.5,2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <rect x="3.5" y="0.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M1.5 3.5H1a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h6a.5.5 0 00.5-.5V9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        )}
      </button>
    </span>
  );
}

// ── Plain field ───────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="modal-label">{label}</dt>
      <dd className="modal-value">{value}</dd>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpiredDate(iso: string | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function humanizeStatus(code: string, t: (key: string) => string): string {
  const key = `details.statusLabels.${normalizeStatusKey(code)}`;
  const translated = t(key);
  return translated === key ? code : translated;
}

function normalizeStatusKey(code: string): string {
  return code.split(/\s+/)[0].toLowerCase();
}
