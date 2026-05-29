import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";

import type { DomainDetails, DomainResult } from "../types/domain";

interface Props {
  domain: DomainResult;
  onClose: () => void;
}

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; details: DomainDetails }
  | { kind: "error"; message: string };

export function DomainDetailsModal({ domain, onClose }: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<FetchState>({ kind: "loading" });

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

  // ESC closes the modal
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
      </div>
    </div>
  );
}

// ── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source?: "rdap" | "whois" }) {
  const { t } = useTranslation();
  if (!source) return null;
  return (
    <span className={`modal-source modal-source-${source}`}>
      {t(`details.source.${source}`)}
    </span>
  );
}

// ── Body content ─────────────────────────────────────────────────────────────

function DetailsContent({ details }: { details: DomainDetails }) {
  const { t } = useTranslation();

  // For WHOIS-source rows we only have the source itself — show a small note.
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
        <Field label={t("details.registrar")} value={details.registrar} />
      )}
      {details.registered && (
        <Field label={t("details.registered")} value={formatDate(details.registered)} />
      )}
      {details.expires && (
        <Field label={t("details.expires")} value={formatDate(details.expires)} />
      )}
      {details.updated && (
        <Field label={t("details.updated")} value={formatDate(details.updated)} />
      )}

      {details.nameservers.length > 0 && (
        <>
          <dt className="modal-label">{t("details.nameservers")}</dt>
          <dd className="modal-value modal-list">
            {details.nameservers.map((ns) => (
              <code key={ns} className="modal-ns">{ns}</code>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="modal-label">{label}</dt>
      <dd className="modal-value">{value}</dd>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Convert EPP/RDAP status codes to friendly labels via i18n keys. Falls back
 *  to the raw code if no translation exists. */
function humanizeStatus(code: string, t: (key: string) => string): string {
  const key = `details.statusLabels.${normalizeStatusKey(code)}`;
  const translated = t(key);
  return translated === key ? code : translated;
}

function normalizeStatusKey(code: string): string {
  // Strip URL portion if present ("active https://..."), lowercase, take first word
  return code.split(/\s+/)[0].toLowerCase();
}
