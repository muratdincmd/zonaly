import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWatchlistNotifications } from "./useWatchlistNotifications";

const mockListen = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({ listen: (...args: unknown[]) => mockListen(...args) }));

const mockIsPermissionGranted = vi.fn();
const mockRequestPermission = vi.fn();
const mockSendNotification = vi.fn();
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: (...args: unknown[]) => mockIsPermissionGranted(...args),
  requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe("useWatchlistNotifications", () => {
  beforeEach(() => {
    mockListen.mockReset();
    mockIsPermissionGranted.mockReset();
    mockRequestPermission.mockReset();
    mockSendNotification.mockReset();
    mockListen.mockResolvedValue(() => {});
  });

  it("registers the listener without requesting permission when already granted", async () => {
    mockIsPermissionGranted.mockResolvedValue(true);

    renderHook(() => useWatchlistNotifications());

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith("watchlist-alert-created", expect.any(Function));
    });
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("requests permission when not already granted, then registers listener if granted", async () => {
    mockIsPermissionGranted.mockResolvedValue(false);
    mockRequestPermission.mockResolvedValue("granted");

    renderHook(() => useWatchlistNotifications());

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalledTimes(1);
      expect(mockListen).toHaveBeenCalledWith("watchlist-alert-created", expect.any(Function));
    });
  });

  it("does not register a listener when permission is denied", async () => {
    mockIsPermissionGranted.mockResolvedValue(false);
    mockRequestPermission.mockResolvedValue("denied");

    renderHook(() => useWatchlistNotifications());

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    });
    expect(mockListen).not.toHaveBeenCalled();
  });

  it.each([
    ["available" as const, "watchlist.alertTypeAvailable"],
    ["status_change" as const, "watchlist.alertTypeChange"],
    ["expiry" as const, "watchlist.alertTypeExpiry"],
  ])("sends a notification with the correct title for alertType=%s", async (alertType, expectedKey) => {
    mockIsPermissionGranted.mockResolvedValue(true);
    let capturedHandler: ((event: { payload: unknown }) => void) | undefined;
    mockListen.mockImplementation((_event: string, handler: (e: { payload: unknown }) => void) => {
      capturedHandler = handler;
      return Promise.resolve(() => {});
    });

    renderHook(() => useWatchlistNotifications());

    await waitFor(() => { expect(capturedHandler).toBeDefined(); });

    capturedHandler!({ payload: { alertType, domain: "example", tld: "com" } });

    expect(mockSendNotification).toHaveBeenCalledWith({
      title: expectedKey,
      body: "example.com",
    });
  });
});
