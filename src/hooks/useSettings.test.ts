import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { readSettings, useSettings } from "./useSettings";
import { DEFAULT_SETTINGS } from "../types/settings";

const STORAGE_KEY = "zonaly.settings";

describe("readSettings", () => {
  beforeEach(() => { window.localStorage.clear(); });

  it("returns defaults when localStorage is empty", () => {
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("merges a partial/older stored blob with defaults", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ notificationsEnabled: false }));
    const settings = readSettings();
    expect(settings.notificationsEnabled).toBe(false);
    expect(settings.maxConcurrency).toBe(DEFAULT_SETTINGS.maxConcurrency);
  });

  it("falls back to defaults when stored JSON is malformed", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("useSettings", () => {
  beforeEach(() => { window.localStorage.clear(); });

  it("update() merges a patch and persists it to localStorage", () => {
    const { result } = renderHook(() => useSettings());

    act(() => { result.current.update({ maxConcurrency: 20 }); });

    expect(result.current.settings.maxConcurrency).toBe(20);
    expect(result.current.settings.notificationsEnabled).toBe(DEFAULT_SETTINGS.notificationsEnabled);

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.maxConcurrency).toBe(20);
  });
});
