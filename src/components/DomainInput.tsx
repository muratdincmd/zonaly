import { useTranslation } from "react-i18next";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function DomainInput({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="domain-input">
      <label htmlFor="domains" className="label">
        {t("input.label")}
      </label>
      <textarea
        id="domains"
        className="textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
