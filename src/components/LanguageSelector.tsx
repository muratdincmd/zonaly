import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "tr", label: "TR" },
  { code: "de", label: "DE" },
  { code: "es", label: "ES" },
  { code: "fr", label: "FR" },
  { code: "it", label: "IT" },
  { code: "pt", label: "PT" },
  { code: "ru", label: "RU" },
  { code: "zh", label: "ZH" },
  { code: "ja", label: "JA" },
  { code: "ko", label: "KO" },
  { code: "ar", label: "AR" },
  { code: "nl", label: "NL" },
  { code: "pl", label: "PL" },
] as const;

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current =
    LANGUAGES.find((l) => i18n.language.startsWith(l.code)) ?? LANGUAGES[0];

  const select = (code: string) => {
    void i18n.changeLanguage(code);
    // RTL support: set dir on <html> for Arabic
    document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
    setOpen(false);
  };

  // Sync dir on mount in case localStorage restored a language
  useEffect(() => {
    document.documentElement.dir =
      i18n.language.startsWith("ar") ? "rtl" : "ltr";
  }, [i18n.language]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="lang-selector" ref={ref}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
      >
        <span className="lang-label">{current.label}</span>
        <svg
          className={`lang-chevron ${open ? "lang-chevron-open" : ""}`}
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
      </button>

      {open && (
        <ul className="lang-menu" role="listbox">
          {LANGUAGES.map((lang) => (
            <li
              key={lang.code}
              role="option"
              aria-selected={lang.code === current.code}
              className={`lang-option ${lang.code === current.code ? "lang-option-active" : ""}`}
              onClick={() => select(lang.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(lang.code);
                }
              }}
              tabIndex={0}
            >
              <span>{lang.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
