import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";
import { AppLogo } from "./AppLogo";
import { LanguageSelector } from "./LanguageSelector";
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
  // TAB BAR GOES HERE — future prop for rendering a tab strip in the centre
  // tabs?: TabItem[];
  // onTabChange?: (id: string) => void;
}

export function TitleBar(_props: TitleBarProps) {
  const win = getCurrentWindow();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    // Sync maximized state on mount and on window resize events
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
      {/* Left: logo — not draggable so clicks on logo work */}
      <div className="titlebar-left" onMouseDown={(e) => e.stopPropagation()}>
        <AppLogo />
      </div>

      {/* Centre: reserved for future tab bar */}
      {/* TAB BAR GOES HERE */}
      <div className="titlebar-centre" data-tauri-drag-region />

      {/* Right: app controls + window buttons */}
      <div className="titlebar-right" onMouseDown={(e) => e.stopPropagation()}>
        <LanguageSelector />
        <ThemeToggle />

        <div className="titlebar-win-btns">
          <button
            className="titlebar-btn titlebar-btn--minimize"
            onClick={handleMinimize}
            aria-label="Minimize"
            tabIndex={-1}
          >
            <IconMinimize />
          </button>
          <button
            className="titlebar-btn titlebar-btn--maximize"
            onClick={handleMaximize}
            aria-label={maximized ? "Restore" : "Maximize"}
            tabIndex={-1}
          >
            {maximized ? <IconRestore /> : <IconMaximize />}
          </button>
          <button
            className="titlebar-btn titlebar-btn--close"
            onClick={handleClose}
            aria-label="Close"
            tabIndex={-1}
          >
            <IconClose />
          </button>
        </div>
      </div>
    </div>
  );
}
