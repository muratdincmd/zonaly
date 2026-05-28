import { useTranslation } from "react-i18next";

import { sanitizeDomains } from "../utils/sanitizeDomains";

interface Props {
  value: string;
  onChange: (value: string, sanitized: boolean) => void;
}

export function DomainInput({ value, onChange }: Props) {
  const { t } = useTranslation();

  const handleChange = (raw: string) => {
    const { value: cleaned, changed } = sanitizeDomains(raw);
    onChange(cleaned, changed);
  };

  return (
    <div className="domain-input">
      <label htmlFor="domains" className="label">
        {t("input.label")}
      </label>
      <textarea
        id="domains"
        className="textarea"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t("input.placeholder")}
        rows={6}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
      />
    </div>
  );
}
