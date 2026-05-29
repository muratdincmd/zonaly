import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MAX_TABS, useTabs } from "../context/TabsContext";

// ── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

function TabContextMenu({
  menu,
  onClose,
}: {
  menu: ContextMenuState;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { tabs, closeTab, closeOtherTabs, closeTabsToRight, duplicateTab } =
    useTabs();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const idx = tabs.findIndex((t) => t.id === menu.tabId);
  const hasRight = idx < tabs.length - 1;
  const hasOther = tabs.length > 1;

  const run = (fn: () => void) => { fn(); onClose(); };

  return (
    <div
      ref={ref}
      className="tab-context-menu"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button onClick={() => run(() => duplicateTab(menu.tabId))}>
        {t("tabs.duplicateTab")}
      </button>
      <div className="tab-context-separator" />
      <button
        onClick={() => run(() => closeTab(menu.tabId))}
      >
        {t("tabs.closeTab")}
      </button>
      <button
        disabled={!hasOther}
        onClick={() => run(() => closeOtherTabs(menu.tabId))}
      >
        {t("tabs.closeOtherTabs")}
      </button>
      <button
        disabled={!hasRight}
        onClick={() => run(() => closeTabsToRight(menu.tabId))}
      >
        {t("tabs.closeTabsToRight")}
      </button>
    </div>
  );
}

// ── Single tab pill ───────────────────────────────────────────────────────────

function TabPill({ tabId }: { tabId: string }) {
  const { t } = useTranslation();
  const { tabs, activeId, activateTab, closeTab } = useTabs();
  const tab = tabs.find((t) => t.id === tabId)!;
  const isActive = tab.id === activeId;

  const label = tab.title || t("tabs.newSearch");

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeTab(tab.id);
  };

  return (
    <div
      className={`tab-pill${isActive ? " tab-pill--active" : ""}`}
      style={{ "--tab-color": tab.color } as React.CSSProperties}
      onClick={() => activateTab(tab.id)}
      title={label}
    >
      <span className="tab-pill-label">{label}</span>
      <button
        className="tab-pill-close"
        onClick={handleClose}
        aria-label={t("tabs.closeTab")}
        tabIndex={-1}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
          <line x1="0.75" y1="0.75" x2="7.25" y2="7.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <line x1="7.25" y1="0.75" x2="0.75" y2="7.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

export function TabBar() {
  const { t } = useTranslation();
  const { tabs, addTab, activeId } = useTabs();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const atMax = tabs.length >= MAX_TABS;

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      setMenu({ tabId, x: e.clientX, y: e.clientY });
    },
    []
  );

  // Close context menu on scroll or Escape
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <>
      <div className="tabbar" onMouseDown={(e) => e.stopPropagation()}>
        <div className="tabbar-strip">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
            >
              <TabPill tabId={tab.id} />
            </div>
          ))}

          <button
            className={`tabbar-add${atMax ? " tabbar-add--disabled" : ""}`}
            onClick={() => !atMax && addTab(activeId)}
            disabled={atMax}
            aria-label={atMax ? t("tabs.maxTabsTooltip") : t("tabs.addTab")}
            title={atMax ? t("tabs.maxTabsTooltip") : t("tabs.addTab")}
            tabIndex={-1}
          >
            +
          </button>
        </div>
      </div>

      {menu && (
        <TabContextMenu menu={menu} onClose={() => setMenu(null)} />
      )}
    </>
  );
}
