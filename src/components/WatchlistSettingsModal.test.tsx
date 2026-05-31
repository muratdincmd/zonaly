import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WatchlistSettingsModal } from "./WatchlistSettingsModal";
import type { WatchlistEntry } from "../types/storage";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }));

// Mock react-i18next — return the key as the translation so assertions are key-stable
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const baseEntry: WatchlistEntry = {
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
};

describe("WatchlistSettingsModal", () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("renders all seven interval options", () => {
    render(
      <WatchlistSettingsModal entry={baseEntry} onClose={() => {}} onSaved={() => {}} />
    );
    // Labels come from t() which returns the key; check the active class is on 24h by default
    const buttons = document.querySelectorAll(".wl-interval-btn");
    expect(buttons).toHaveLength(7);
    const active = document.querySelector(".wl-interval-btn--active");
    expect(active).toBeInTheDocument();
    // 24h is the default interval in baseEntry — verify it carries the active class
    expect(active?.textContent).toBe("watchlist.interval24h");
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("clicking Save calls update_watchlist_settings with correct args", async () => {
    const updatedEntry = { ...baseEntry, checkIntervalHours: 6 };
    mockInvoke.mockResolvedValue(updatedEntry);
    const onSaved = vi.fn();

    render(
      <WatchlistSettingsModal entry={baseEntry} onClose={() => {}} onSaved={onSaved} />
    );

    // Switch interval to 6h (third button)
    const intervalBtns = document.querySelectorAll(".wl-interval-btn");
    fireEvent.click(intervalBtns[2]); // index 2 = 6h

    fireEvent.click(screen.getByText("watchlist.save"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_watchlist_settings", {
        id: 1,
        settings: expect.objectContaining({
          checkIntervalHours: 6,
        }),
      });
    });

    expect(onSaved).toHaveBeenCalledWith(updatedEntry);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("toggling alert checkboxes changes their checked state", () => {
    render(
      <WatchlistSettingsModal entry={baseEntry} onClose={() => {}} onSaved={() => {}} />
    );

    const checkboxes = document.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
    expect(checkboxes).toHaveLength(3); // available, change, expiry

    // All start checked (baseEntry has all true)
    checkboxes.forEach((cb) => expect(cb.checked).toBe(true));

    // Uncheck the first (alertOnAvailable)
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(false);

    // Re-check it
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(true);

    // Uncheck expiry → days input should become disabled
    const expiryCheckbox = checkboxes[2];
    const daysInput = document.querySelector<HTMLInputElement>("input[type='number']")!;
    expect(daysInput.disabled).toBe(false);
    fireEvent.click(expiryCheckbox);
    expect(daysInput.disabled).toBe(true);
  });

  // ── Extra: Escape key closes the modal ──────────────────────────────────────

  it("pressing Escape calls onClose", () => {
    const onClose = vi.fn();
    render(
      <WatchlistSettingsModal entry={baseEntry} onClose={onClose} onSaved={() => {}} />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
