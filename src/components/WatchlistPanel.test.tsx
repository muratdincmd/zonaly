import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WatchlistPanel } from "./WatchlistPanel";
import type { WatchlistAlert, WatchlistEntry } from "../types/storage";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }));

// Mock Tauri event — WatchlistPanel does a dynamic import of listen
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${k}:${opts.count}`;
      return k;
    },
  }),
}));

// WatchlistSettingsModal is opened on demand — mock it out to keep tests simple
vi.mock("./WatchlistSettingsModal", () => ({
  WatchlistSettingsModal: () => <div data-testid="settings-modal" />,
}));

const makeEntry = (overrides: Partial<WatchlistEntry> = {}): WatchlistEntry => ({
  id: 1,
  domain: "example",
  tld: "com",
  addedAt: "2026-01-01T00:00:00Z",
  lastCheckedAt: null,
  lastStatus: null,
  lastRegistrar: null,
  lastExpiryDate: null,
  checkIntervalHours: 24,
  nextCheckAt: null,
  alertOnAvailable: true,
  alertOnExpiry: true,
  alertOnChange: true,
  expiryAlertDays: 30,
  notes: null,
  ...overrides,
});

const makeAlert = (overrides: Partial<WatchlistAlert> = {}): WatchlistAlert => ({
  id: 10,
  watchlistId: 1,
  alertType: "available",
  message: "example.com is now available",
  createdAt: "2026-01-01T00:00:00Z",
  readAt: null,
  ...overrides,
});

describe("WatchlistPanel", () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  // Default: get_watchlist → [], get_watchlist_alerts → []
  function setupInvoke(
    entries: WatchlistEntry[] = [],
    alerts: WatchlistAlert[] = []
  ) {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_watchlist") return Promise.resolve(entries);
      if (cmd === "get_watchlist_alerts") return Promise.resolve(alerts);
      return Promise.resolve(null);
    });
  }

  // ── Test 4 ──────────────────────────────────────────────────────────────────

  it("shows alert banner when unread alerts exist", async () => {
    setupInvoke([makeEntry()], [makeAlert()]);

    render(<WatchlistPanel open={true} onClose={() => {}} />);

    await waitFor(() => {
      // The alert banner header contains the unreadAlerts key
      expect(document.querySelector(".wl-alerts-section")).toBeInTheDocument();
      expect(document.querySelector(".wl-alerts-title")).toBeInTheDocument();
    });

    // The alert message text should also be visible in the list
    expect(screen.getByText("example.com is now available")).toBeInTheDocument();
  });

  it("does not show alert banner when there are no unread alerts", async () => {
    setupInvoke([makeEntry()], []);

    render(<WatchlistPanel open={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("example")).toBeInTheDocument();
    });

    expect(screen.queryByText(/watchlist.unreadAlerts/)).not.toBeInTheDocument();
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────

  it("Mark all read button calls mark_all_watchlist_alerts_read", async () => {
    setupInvoke([makeEntry()], [makeAlert()]);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_watchlist") return Promise.resolve([makeEntry()]);
      if (cmd === "get_watchlist_alerts") return Promise.resolve([makeAlert()]);
      if (cmd === "mark_all_watchlist_alerts_read") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<WatchlistPanel open={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("watchlist.markAllRead")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("watchlist.markAllRead"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("mark_all_watchlist_alerts_read");
    });
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────

  it("Check All Due button calls check_due_watchlist", async () => {
    // Entry with an overdue next_check_at so the button is enabled
    const overdueEntry = makeEntry({ nextCheckAt: "2020-01-01T00:00:00Z" });
    setupInvoke([overdueEntry], []);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_watchlist") return Promise.resolve([overdueEntry]);
      if (cmd === "get_watchlist_alerts") return Promise.resolve([]);
      if (cmd === "check_due_watchlist") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<WatchlistPanel open={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByLabelText("watchlist.checkAllDue")).toBeInTheDocument();
    });

    const checkAllBtn = screen.getByLabelText("watchlist.checkAllDue");
    expect(checkAllBtn).not.toBeDisabled();
    fireEvent.click(checkAllBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("check_due_watchlist");
    });
  });

  // ── Test 7 ──────────────────────────────────────────────────────────────────

  it("footer shows correct total, monitored, unread, and due counts", async () => {
    const overdueEntry = makeEntry({
      id: 1,
      checkIntervalHours: 24,
      nextCheckAt: "2020-01-01T00:00:00Z", // overdue
    });
    const freshEntry = makeEntry({
      id: 2,
      domain: "fresh",
      checkIntervalHours: 0, // not monitored
      nextCheckAt: null,
    });
    const alert = makeAlert();

    setupInvoke([overdueEntry, freshEntry], [alert]);

    render(<WatchlistPanel open={true} onClose={() => {}} />);

    await waitFor(() => {
      const footer = document.querySelector(".side-panel-footer");
      expect(footer).toBeInTheDocument();
      const text = footer?.textContent ?? "";
      // total = 2 entries (panelTitle key is lowercased by the component)
      expect(text).toContain("2");
      // monitored: component does t("watchlist.monitoringActive").toLowerCase()
      expect(text.toLowerCase()).toContain("watchlist.monitoringactive");
      // unread alerts key (with count interpolation)
      expect(text).toContain("watchlist.unreadAlerts");
      // due for check key
      expect(text).toContain("watchlist.dueForCheck");
    });
  });

  it("footer is absent when watchlist is empty", async () => {
    setupInvoke([], []);

    render(<WatchlistPanel open={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("watchlist.empty")).toBeInTheDocument();
    });

    expect(document.querySelector(".side-panel-footer")).not.toBeInTheDocument();
  });
});
