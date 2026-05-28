import { useState } from "react";
import { useTranslation } from "react-i18next";

export const TLDS_DEFAULT = [
  "com",
  "net",
  "org",
  "io",
  "co",
  "app",
  "dev",
  "ai",
  "info",
  "biz",
];

export const TLDS_MORE = [
  "eu",
  "uk",
  "de",
  "fr",
  "tr",
  "store",
  "shop",
  "online",
  "tech",
  "me",
  "us",
  "ca",
  "au",
  "xyz",
  "club",
];

export const TLDS_ALL = [...TLDS_DEFAULT, ...TLDS_MORE];

// ccTLDs with no RDAP endpoint in the IANA bootstrap.
// Add/remove entries here as coverage changes.
export const TLDS_NO_RDAP = new Set([
  "de",
  "fr",
  "tr",
  "eu",
  "uk",
  "us",
  "ca",
  "au",
]);

interface Props {
  selected: Set<string>;
  onToggle: (tld: string) => void;
}

export function ExtensionPicker({ selected, onToggle }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const tlds = expanded ? TLDS_ALL : TLDS_DEFAULT;

  return (
    <div className="ext-picker">
      <div className="ext-grid">
        {tlds.map((tld) => {
          const unavailable = TLDS_NO_RDAP.has(tld);
          return unavailable ? (
            <span
              key={tld}
              className="ext-chip ext-chip-disabled"
              title={t("extensions.rdapUnavailable")}
              aria-disabled="true"
            >
              <input
                type="checkbox"
                disabled
                checked={false}
                readOnly
                tabIndex={-1}
              />
              <span>.{tld}</span>
            </span>
          ) : (
            <label key={tld} className="ext-chip">
              <input
                type="checkbox"
                checked={selected.has(tld)}
                onChange={() => onToggle(tld)}
              />
              <span>.{tld}</span>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        className="ext-toggle"
        onClick={() => setExpanded((s) => !s)}
      >
        {expanded ? t("extensions.showLess") : t("extensions.showMore")}
      </button>
    </div>
  );
}
