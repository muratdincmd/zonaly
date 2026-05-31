import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppLogo } from "./AppLogo";
import { LanguageSelector } from "./LanguageSelector";
import { TabBar } from "./TabBar";
import { ThemeToggle } from "./ThemeToggle";

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

interface TitleBarProps {
  onOpenHistory?: () => void;
  onOpenWatchlist?: () => void;
}

export function TitleBar({ onOpenHistory, onOpenWatchlist }: TitleBarProps) {
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
            className="titlebar-btn titlebar-btn--icon"
            onClick={onOpenWatchlist}
            aria-label={t("watchlist.panelTitle")}
            title={t("watchlist.panelTitle")}
            tabIndex={-1}
          >
            <svg width="12" height="13" viewBox="0 0 12 13" fill="none" aria-hidden="true">
              <path d="M2 1h8a.5.5 0 01.5.5v10l-4.5-2.5L1.5 11.5V1.5A.5.5 0 012 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        <LanguageSelector />
        <ThemeToggle />

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
