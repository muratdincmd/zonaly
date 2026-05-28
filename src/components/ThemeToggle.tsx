import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";

export function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={t("theme.toggle")}
      title={t("theme.toggle")}
      className={`theme-switch ${isDark ? "theme-switch-dark" : ""}`}
      onClick={toggle}
    >
      <span className="theme-switch-thumb">
        {/* Sun — visible in light mode */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          aria-hidden="true"
          className="thumb-icon thumb-icon-sun"
        >
          <circle cx="8" cy="8" r="2.8" />
          <line x1="8" y1="1.5"  x2="8" y2="3.2"  />
          <line x1="8" y1="12.8" x2="8" y2="14.5" />
          <line x1="1.5" y1="8"  x2="3.2" y2="8"  />
          <line x1="12.8" y1="8" x2="14.5" y2="8" />
          <line x1="3.4"  y1="3.4"  x2="4.6" y2="4.6" />
          <line x1="11.4" y1="11.4" x2="12.6" y2="12.6" />
          <line x1="3.4"  y1="12.6" x2="4.6"  y2="11.4" />
          <line x1="11.4" y1="4.6"  x2="12.6" y2="3.4"  />
        </svg>

        {/* Moon — visible in dark mode */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="thumb-icon thumb-icon-moon"
        >
          <path d="M12 9.5A5 5 0 0 1 6.5 4a5 5 0 1 0 5.5 5.5z" />
        </svg>
      </span>
    </button>
  );
}
