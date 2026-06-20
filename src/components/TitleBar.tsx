import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppLogo } from "./AppLogo";
import { LanguageSelector } from "./LanguageSelector";
import { TabBar } from "./TabBar";

// Window control button SVG icons
function IconMinimize() {
  return (
    <svg width="10" height="1" viewBox="0 0 10 1" fill="none" aria-hidden="true">
      <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  );
}

function IconMaximize() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="0.625" y="0.625" width="8.75" height="8.75" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  );
}

function IconRestore() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="2.125" y="0.625" width="7.25" height="7.25" rx="1.25" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M1 2.5V8.5C1 9.05 1.45 9.5 2 9.5H8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <line x1="0.75" y1="0.75" x2="9.25" y2="9.25" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/>
      <line x1="9.25" y1="0.75" x2="0.75" y2="9.25" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/>
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.2l.85 1.5c.42-.08.86-.08 1.28 0l.92-1.43 1.66.78-.46 1.64c.32.29.6.62.83.98l1.68-.3.6 1.74-1.4 1.02c.06.43.06.86 0 1.3l1.4 1.02-.6 1.74-1.68-.3a4.9 4.9 0 0 1-.83.98l.46 1.64-1.66.78-.92-1.43c-.42.08-.86.08-1.28 0L8 14.8l-.85-1.5a4.9 4.9 0 0 1-1.28 0l-.92 1.43-1.66-.78.46-1.64a4.9 4.9 0 0 1-.83-.98l-1.68.3-.6-1.74 1.4-1.02a5.1 5.1 0 0 1 0-1.3L.64 6.55l.6-1.74 1.68.3c.23-.36.5-.69.83-.98l-.46-1.64 1.66-.78.92 1.43c.42-.08.86-.08 1.28 0L8 1.2z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.1"/>
    </svg>
  );
}

interface TitleBarProps {
  onOpenHistory?: () => void;
  onOpenWatchlist?: () => void;
  onOpenSettings?: () => void;
  watchlistUnread?: number;
}

export function TitleBar({ onOpenHistory, onOpenWatchlist, onOpenSettings, watchlistUnread = 0 }: TitleBarProps) {
  const win = getCurrentWindow();
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void win.isMaximized().then(setMaximized);
    void win.onResized(() => {
      void win.isMaximized().then(setMaximized);
    }).then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, [win]);

  const handleMinimize = () => void win.minimize();
  const handleMaximize = () => {
    if (maximized) void win.unmaximize();
    else void win.maximize();
  };
  const handleClose = () => void win.close();

  return (
    <div className="titlebar" data-tauri-drag-region>
      {/* Left: logo */}
      <div className="titlebar-left" onMouseDown={(e) => e.stopPropagation()}>
        <AppLogo />
      </div>

      {/* Centre: tab bar */}
      <div className="titlebar-centre">
        <TabBar />
      </div>

      {/* Right: panel buttons + app controls + window buttons */}
      <div className="titlebar-right" onMouseDown={(e) => e.stopPropagation()}>
        {onOpenHistory && (
          <button
            className="titlebar-btn titlebar-btn--icon"
            onClick={onOpenHistory}
            aria-label={t("history.panelTitle")}
            title={t("history.panelTitle")}
            tabIndex={-1}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.25"/>
              <path d="M6.5 4v2.5l1.8 1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {onOpenWatchlist && (
          <button
            className="titlebar-btn titlebar-btn--icon titlebar-btn--watchlist"
            onClick={onOpenWatchlist}
            aria-label={t("watchlist.panelTitle")}
            title={t("watchlist.panelTitle")}
            tabIndex={-1}
          >
            <svg width="12" height="13" viewBox="0 0 12 13" fill="none" aria-hidden="true">
              <path d="M2 1h8a.5.5 0 01.5.5v10l-4.5-2.5L1.5 11.5V1.5A.5.5 0 012 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {watchlistUnread > 0 && (
              <span className="titlebar-badge">{watchlistUnread > 9 ? "9+" : watchlistUnread}</span>
            )}
          </button>
        )}

        {onOpenSettings && (
          <button
            className="titlebar-btn titlebar-btn--icon"
            onClick={onOpenSettings}
            aria-label={t("footer.settings")}
            title={t("footer.settings")}
            tabIndex={-1}
          >
            <IconSettings />
          </button>
        )}

        <LanguageSelector />

        <div className="titlebar-win-btns">
          <button
            className="titlebar-btn titlebar-btn--minimize"
            onClick={handleMinimize}
            aria-label={t("titlebar.minimize")}
            tabIndex={-1}
          >
            <IconMinimize />
          </button>
          <button
            className="titlebar-btn titlebar-btn--maximize"
            onClick={handleMaximize}
            aria-label={maximized ? t("titlebar.restore") : t("titlebar.maximize")}
            tabIndex={-1}
          >
            {maximized ? <IconRestore /> : <IconMaximize />}
          </button>
          <button
            className="titlebar-btn titlebar-btn--close"
            onClick={handleClose}
            aria-label={t("titlebar.close")}
            tabIndex={-1}
          >
            <IconClose />
          </button>
        </div>
      </div>
    </div>
  );
}
