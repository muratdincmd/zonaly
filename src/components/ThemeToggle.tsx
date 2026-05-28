import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";

export function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      title={t("theme.toggle")}
      aria-label={t("theme.toggle")}
    >
      {resolvedTheme === "dark" ? "☀" : "☾"}
    </button>
  );
}
