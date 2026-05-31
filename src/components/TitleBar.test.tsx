import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TitleBar } from "./TitleBar";

// Tauri window API — not needed for badge logic
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isMaximized: () => Promise.resolve(false),
    onResized: () => Promise.resolve(() => {}),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

// Child components are not under test here — stub them out
vi.mock("./AppLogo", () => ({ AppLogo: () => <div data-testid="logo" /> }));
vi.mock("./TabBar", () => ({ TabBar: () => <div data-testid="tabbar" /> }));
vi.mock("./LanguageSelector", () => ({ LanguageSelector: () => <div data-testid="lang" /> }));
vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => <div data-testid="theme" /> }));

// ── Context required by TabBar (even when mocked, the context may still be read)
vi.mock("../context/TabsContext", () => ({
  useTabs: () => ({ tabs: [], activeId: null, dispatch: vi.fn() }),
  TabsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("TitleBar", () => {
  // ── Test 8 ────────────────────────────────────────────────────────────────

  it("does not show badge when watchlistUnread is 0", () => {
    render(<TitleBar onOpenWatchlist={() => {}} watchlistUnread={0} />);
    expect(document.querySelector(".titlebar-badge")).not.toBeInTheDocument();
  });

  it("shows badge with count when watchlistUnread > 0", () => {
    render(<TitleBar onOpenWatchlist={() => {}} watchlistUnread={3} />);
    const badge = document.querySelector(".titlebar-badge");
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toBe("3");
  });

  it("caps badge display at 9+ when unread count exceeds 9", () => {
    render(<TitleBar onOpenWatchlist={() => {}} watchlistUnread={15} />);
    const badge = document.querySelector(".titlebar-badge");
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toBe("9+");
  });

  it("does not render watchlist button at all when onOpenWatchlist is not provided", () => {
    render(<TitleBar watchlistUnread={5} />);
    expect(document.querySelector(".titlebar-btn--watchlist")).not.toBeInTheDocument();
  });
});
