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

type LangCode = (typeof LANGUAGES)[number]["code"];

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current =
    LANGUAGES.find((l) => i18n.language.startsWith(l.code)) ?? LANGUAGES[0];

  const select = (code: LangCode) => {
    void i18n.changeLanguage(code);
    document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
    setOpen(false);
  };

  useEffect(() => {
    document.documentElement.dir =
      i18n.language.startsWith("ar") ? "rtl" : "ltr";
  }, [i18n.language]);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
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
        <div className="lang-menu" role="listbox" aria-label="Select language">
          <div className="lang-grid">
            {LANGUAGES.map((lang) => {
              const active = lang.code === current.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`lang-tile ${active ? "lang-tile-active" : ""}`}
                  onClick={() => select(lang.code)}
                >
                  <span className="lang-tile-code">{lang.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
