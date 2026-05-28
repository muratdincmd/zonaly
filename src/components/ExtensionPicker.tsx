import { useState } from "react";
import { useTranslation } from "react-i18next";

// ── TLD data ──────────────────────────────────────────────────────────────

export interface TldCategory {
  key: string;
  tlds: string[];
  openByDefault?: boolean;
}

export const TLD_CATEGORIES: TldCategory[] = [
  {
    key: "popular",
    openByDefault: true,
    tlds: [
      "com", "net", "org", "io", "co", "app", "dev", "ai", "info", "biz",
      "me", "us", "ca", "au", "xyz", "club", "online", "site", "tech",
      "store", "shop",
    ],
  },
  {
    key: "country",
    tlds: [
      "tr", "de", "uk", "fr", "eu", "es", "it", "nl", "pl", "ru",
      "br", "jp", "cn", "in", "mx", "ar", "pt", "se", "no", "fi",
      "dk", "be", "ch", "at", "nz", "za", "kr", "sg", "hk", "ae", "sa",
    ],
  },
  {
    key: "business",
    tlds: [
      "agency", "consulting", "solutions", "services", "software", "systems",
      "network", "email", "media", "digital", "cloud", "host", "web",
      "page", "link", "click",
    ],
  },
  {
    key: "creative",
    tlds: [
      "studio", "design", "art", "photo", "photography", "video", "music",
      "film", "creative",
    ],
  },
  {
    key: "tech",
    tlds: [
      "academy", "engineering", "hosting", "server", "io", "dev", "ai",
      "software", "systems", "cloud",
    ],
  },
];

// Flat deduplicated list of all TLDs across all categories
export const TLDS_ALL: string[] = [
  ...new Set(TLD_CATEGORIES.flatMap((c) => c.tlds)),
];

// Legacy exports kept for App.tsx compatibility
export const TLDS_DEFAULT = TLD_CATEGORIES[0].tlds.slice(0, 10);

// ccTLDs with no RDAP endpoint in the IANA bootstrap.
// Add/remove entries here as coverage expands.
export const TLDS_NO_RDAP = new Set([
  "tr", "de", "fr", "eu", "uk", "us", "ca", "au",
  "es", "it", "nl", "pl", "ru", "br", "jp", "cn",
  "in", "mx", "ar", "pt", "se", "no", "fi", "dk",
  "be", "ch", "at", "nz", "za", "kr", "sg", "hk",
  "ae", "sa",
]);

// ── Sub-components ────────────────────────────────────────────────────────

interface ChipProps {
  tld: string;
  checked: boolean;
  disabled: boolean;
  tooltip: string;
  onToggle: () => void;
}

function TldChip({ tld, checked, disabled, tooltip, onToggle }: ChipProps) {
  if (disabled) {
    return (
      <span
        className="ext-chip ext-chip-disabled"
        title={tooltip}
        aria-disabled="true"
      >
        <input type="checkbox" disabled checked={false} readOnly tabIndex={-1} />
        <span>.{tld}</span>
      </span>
    );
  }
  return (
    <label className="ext-chip">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span>.{tld}</span>
    </label>
  );
}

interface CategoryProps {
  category: TldCategory;
  selected: Set<string>;
  onToggle: (tld: string) => void;
  onBulkToggle: (tlds: string[], select: boolean) => void;
  rdapTooltip: string;
  labelName: string;
}

function CategorySection({
  category,
  selected,
  onToggle,
  onBulkToggle,
  rdapTooltip,
  labelName,
}: CategoryProps) {
  const [open, setOpen] = useState(category.openByDefault ?? false);

  const available = category.tlds.filter((t) => !TLDS_NO_RDAP.has(t));
  const allSelected =
    available.length > 0 && available.every((t) => selected.has(t));
  const someSelected = available.some((t) => selected.has(t));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    onBulkToggle(available, e.target.checked);
  };

  return (
    <div className="cat-section">
      <div
        className="cat-header"
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        aria-expanded={open}
      >
        {/* Select-all checkbox — stops propagation so it doesn't toggle collapse */}
        <span
          className="cat-select-all"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allSelected && someSelected;
            }}
            onChange={handleSelectAll}
            aria-label={`Select all ${labelName}`}
            tabIndex={0}
          />
        </span>

        <span className="cat-name">{labelName}</span>

        <span className="cat-count">
          {category.tlds.length}
        </span>

        <svg
          className={`cat-arrow ${open ? "cat-arrow-open" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="4 6 8 10 12 6" />
        </svg>
      </div>

      <div className={`cat-body ${open ? "cat-body-open" : ""}`}>
        <div className="cat-body-inner">
          <div className="ext-grid">
            {category.tlds.map((tld) => (
              <TldChip
                key={tld}
                tld={tld}
                checked={selected.has(tld)}
                disabled={TLDS_NO_RDAP.has(tld)}
                tooltip={rdapTooltip}
                onToggle={() => onToggle(tld)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  selected: Set<string>;
  onToggle: (tld: string) => void;
  onBulkToggle: (tlds: string[], select: boolean) => void;
}

export function ExtensionPicker({ selected, onToggle, onBulkToggle }: Props) {
  const { t } = useTranslation();

  const totalAvailable = TLDS_ALL.filter((tld) => !TLDS_NO_RDAP.has(tld)).length;
  const selectedCount = [...selected].filter((tld) => !TLDS_NO_RDAP.has(tld)).length;

  return (
    <div className="ext-picker">
      <div className="ext-picker-meta">
        <span className="ext-meta-selected">
          {t("extensions.selectedCount", { count: selectedCount })}
        </span>
        <span className="ext-meta-total">
          {t("extensions.totalCount", { count: totalAvailable })}
        </span>
      </div>

      <div className="cat-list">
        {TLD_CATEGORIES.map((cat) => (
          <CategorySection
            key={cat.key}
            category={cat}
            selected={selected}
            onToggle={onToggle}
            onBulkToggle={onBulkToggle}
            rdapTooltip={t("extensions.rdapUnavailable")}
            labelName={t(`extensions.categories.${cat.key}`)}
          />
        ))}
      </div>
    </div>
  );
}
