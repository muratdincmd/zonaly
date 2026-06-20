import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import pkg from "../../package.json";
import { useSettings } from "../hooks/useSettings";
import { useTheme } from "../theme/ThemeProvider";
import { DONATE_URL, GitHubIcon, HeartIcon } from "./AppFooter";
import { changeLanguage, LANGUAGES } from "./LanguageSelector";

interface CacheInfo {
  exists: boolean;
  sizeBytes: number;
  ageSecs: number;
}

type TabId = "general" | "cache" | "notifications" | "monitoring" | "about";
const TABS: TabId[] = ["general", "cache", "notifications", "monitoring", "about"];

const INTERVALS = [1, 3, 6, 12, 24, 48, 168] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("general");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal modal--settings" onClick={(e) => e.stopPropagation()} role="document">
        <header className="modal-header">
          <div className="modal-title-group">
            <span className="modal-domain-name">{t("settings.panelTitle")}</span>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t("details.close")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        <div className="settings-tabs" role="tablist">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`settings-tab-btn${tab === id ? " settings-tab-btn--active" : ""}`}
              onClick={() => setTab(id)}
            >
              {t(`settings.tabs.${id}`)}
            </button>
          ))}
        </div>

        <div className="wl-settings-body">
          {tab === "general" && <GeneralTab />}
          {tab === "cache" && <CacheTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "monitoring" && <MonitoringTab />}
          {tab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

// ── General ────────────────────────────────────────────────────────────────────

function GeneralTab() {
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useTheme();
  const { settings, update } = useSettings();
  const [autoStart, setAutoStart] = useState(settings.autoStartEnabled);

  const currentLang =
    LANGUAGES.find((l) => i18n.language.startsWith(l.code)) ?? LANGUAGES[0];

  useEffect(() => {
    isAutostartEnabled()
      .then((enabled) => { setAutoStart(enabled); update({ autoStartEnabled: enabled }); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAutoStartToggle = async (checked: boolean) => {
    setAutoStart(checked);
    update({ autoStartEnabled: checked });
    try {
      if (checked) await enableAutostart();
      else await disableAutostart();
    } catch (e) {
      console.error("autostart toggle failed", e);
    }
  };

  return (
    <>
      <div className="wl-settings-section">
        <span className="wl-settings-label">{t("settings.general.theme")}</span>
        <div className="wl-interval-options">
          {(["light", "dark", "system"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`wl-interval-btn${mode === m ? " wl-interval-btn--active" : ""}`}
              onClick={() => setMode(m)}
            >
              {t(`settings.general.theme${m[0].toUpperCase()}${m.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="wl-settings-section">
        <span className="wl-settings-label">{t("settings.general.language")}</span>
        <div className="settings-lang-grid" role="listbox" aria-label={t("aria.select_language")}>
          {LANGUAGES.map((lang) => {
            const active = lang.code === currentLang.code;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={active}
                className={`settings-lang-tile${active ? " settings-lang-tile--active" : ""}`}
                onClick={() => changeLanguage(i18n, lang.code)}
              >
                {lang.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="wl-settings-section">
        <label className="wl-checkbox-row">
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => void handleAutoStartToggle(e.target.checked)}
          />
          <span>{t("settings.general.autoStart")}</span>
        </label>
      </div>
    </>
  );
}

// ── Cache ──────────────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAge(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function CacheTab() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<CacheInfo | null>(null);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const load = () => {
    invoke<CacheInfo>("get_cache_info").then(setInfo).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    setClearing(true);
    try {
      await invoke("clear_rdap_cache");
      load();
      setCleared(true);
      setTimeout(() => setCleared(false), 2000);
    } catch (e) {
      console.error("clear_rdap_cache failed", e);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="wl-settings-section">
      {info?.exists ? (
        <>
          <div className="wl-checkbox-row">
            <span>{t("settings.cache.age")}:</span>
            <strong>{formatAge(info.ageSecs)}</strong>
          </div>
          <div className="wl-checkbox-row">
            <span>{t("settings.cache.size")}:</span>
            <strong>{formatBytes(info.sizeBytes)}</strong>
          </div>
        </>
      ) : (
        <span className="wl-settings-label">{t("settings.cache.noCache")}</span>
      )}
      <button type="button" className="btn-secondary" onClick={() => void handleClear()} disabled={clearing}>
        {cleared ? t("settings.cache.cleared") : t("settings.cache.clear")}
      </button>
    </div>
  );
}

// ── Notifications ──────────────────────────────────────────────────────────────

function NotificationsTab() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();

  return (
    <>
      <div className="wl-settings-section">
        <label className="wl-checkbox-row">
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={(e) => update({ notificationsEnabled: e.target.checked })}
          />
          <span>{t("settings.notifications.enabled")}</span>
        </label>
      </div>

      <div className="wl-settings-section">
        <span className="wl-settings-label">{t("settings.notifications.defaultsLabel")}</span>
        <label className="wl-checkbox-row">
          <input
            type="checkbox"
            checked={settings.defaultAlertOnAvailable}
            onChange={(e) => update({ defaultAlertOnAvailable: e.target.checked })}
          />
          <span>{t("watchlist.alertOnAvailable")}</span>
        </label>
        <label className="wl-checkbox-row">
          <input
            type="checkbox"
            checked={settings.defaultAlertOnChange}
            onChange={(e) => update({ defaultAlertOnChange: e.target.checked })}
          />
          <span>{t("watchlist.alertOnChange")}</span>
        </label>
        <label className="wl-checkbox-row">
          <input
            type="checkbox"
            checked={settings.defaultAlertOnExpiry}
            onChange={(e) => update({ defaultAlertOnExpiry: e.target.checked })}
          />
          <span>
            {t("watchlist.alertOnExpiry")}{" "}
            <input
              type="number"
              className="wl-days-input"
              min={1}
              max={365}
              value={settings.defaultExpiryAlertDays}
              onChange={(e) =>
                update({ defaultExpiryAlertDays: Math.max(1, Math.min(365, Number(e.target.value))) })
              }
              disabled={!settings.defaultAlertOnExpiry}
            />{" "}
            {t("watchlist.alertDaysSuffix")}
          </span>
        </label>
      </div>
    </>
  );
}

// ── Monitoring ─────────────────────────────────────────────────────────────────

function MonitoringTab() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();

  const intervalLabel = (h: number) => {
    if (h === 1)   return t("watchlist.interval1h");
    if (h === 3)   return t("watchlist.interval3h");
    if (h === 6)   return t("watchlist.interval6h");
    if (h === 12)  return t("watchlist.interval12h");
    if (h === 24)  return t("watchlist.interval24h");
    if (h === 48)  return t("watchlist.interval48h");
    return t("watchlist.intervalWeekly");
  };

  const handleMaxConcurrencyChange = (value: number) => {
    const clamped = Math.max(1, Math.min(30, value));
    update({ maxConcurrency: clamped });
    void invoke("set_max_concurrency", { value: clamped });
  };

  return (
    <>
      <div className="wl-settings-section">
        <span className="wl-settings-label">{t("settings.monitoring.defaultInterval")}</span>
        <div className="wl-interval-options">
          {INTERVALS.map((h) => (
            <button
              key={h}
              type="button"
              className={`wl-interval-btn${settings.defaultCheckIntervalHours === h ? " wl-interval-btn--active" : ""}`}
              onClick={() => update({ defaultCheckIntervalHours: h })}
            >
              {intervalLabel(h)}
            </button>
          ))}
        </div>
      </div>

      <div className="wl-settings-section">
        <span className="wl-settings-label">{t("settings.monitoring.maxConcurrency")}</span>
        <input
          type="number"
          className="wl-days-input"
          min={1}
          max={30}
          value={settings.maxConcurrency}
          onChange={(e) => handleMaxConcurrencyChange(Number(e.target.value))}
        />
        <span className="modal-subtitle">{t("settings.monitoring.maxConcurrencyHint")}</span>
      </div>
    </>
  );
}

// ── About ──────────────────────────────────────────────────────────────────────

function AboutTab() {
  const { t } = useTranslation();

  const openUrl = (url: string) => void invoke("open_url", { url });

  return (
    <div className="wl-settings-section">
      <div className="wl-checkbox-row">
        <span>{t("settings.about.version")}:</span>
        <strong>v{pkg.version}</strong>
      </div>
      <button
        type="button"
        className="footer-link footer-author settings-about-author"
        onClick={() => openUrl("https://github.com/muratdincmd")}
      >
        <GitHubIcon />
        muratdincmd
      </button>
      <button type="button" className="donate-btn" onClick={() => openUrl(DONATE_URL)}>
        <HeartIcon className="footer-heart-icon" />
        {t("footer.donate")}
      </button>
      <button type="button" className="btn-secondary" onClick={() => openUrl("https://github.com/muratdincmd/zonaly/blob/main/CHANGELOG.md")}>
        {t("settings.about.changelog")}
      </button>
      <button type="button" className="btn-secondary" onClick={() => openUrl("https://github.com/muratdincmd/zonaly")}>
        {t("settings.about.github")}
      </button>
      <button type="button" className="btn-secondary" onClick={() => openUrl("https://github.com/muratdincmd/zonaly/releases")}>
        {t("settings.about.checkUpdates")}
      </button>
    </div>
  );
}
