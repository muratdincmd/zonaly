import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SettingsModal } from "./SettingsModal";
import { ThemeProvider } from "../theme/ThemeProvider";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }));

vi.mock("@tauri-apps/plugin-autostart", () => ({
  isEnabled: vi.fn().mockResolvedValue(false),
  enable: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en", changeLanguage: vi.fn() } }),
}));

function renderModal(onClose = vi.fn()) {
  return render(
    <ThemeProvider>
      <SettingsModal open onClose={onClose} />
    </ThemeProvider>
  );
}

describe("SettingsModal", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_cache_info") return Promise.resolve({ exists: false, sizeBytes: 0, ageSecs: 0 });
      return Promise.resolve(undefined);
    });
    window.localStorage.clear();
    window.matchMedia = window.matchMedia ?? vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("renders all 5 tabs and switches between them", () => {
    renderModal();
    const tabs = document.querySelectorAll(".settings-tab-btn");
    expect(tabs).toHaveLength(5);

    fireEvent.click(screen.getByText("settings.tabs.cache"));
    expect(document.querySelector(".settings-tab-btn--active")?.textContent).toBe("settings.tabs.cache");
  });

  it("clicking a theme button switches the active theme", () => {
    renderModal();
    const themeButtons = document.querySelectorAll(".wl-interval-btn");
    fireEvent.click(themeButtons[1]); // dark
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("Cache tab fetches cache info on mount and clears it on click", async () => {
    renderModal();
    fireEvent.click(screen.getByText("settings.tabs.cache"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_cache_info");
    });

    fireEvent.click(screen.getByText("settings.cache.clear"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("clear_rdap_cache");
    });
  });

  it("Monitoring tab changing max concurrency calls set_max_concurrency", async () => {
    renderModal();
    fireEvent.click(screen.getByText("settings.tabs.monitoring"));

    const input = document.querySelectorAll<HTMLInputElement>("input[type='number']")[0];
    fireEvent.change(input, { target: { value: "15" } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_max_concurrency", { value: 15 });
    });
  });

  it("pressing Escape calls onClose", () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
