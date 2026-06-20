import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type ZonalySettings } from "../types/settings";

const STORAGE_KEY = "zonaly.settings";

/// Merge a possibly-partial/older stored blob with defaults, key by key, so
/// a schema change in a future version never crashes on an old blob.
function mergeWithDefaults(raw: unknown): ZonalySettings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS };
  const partial = raw as Partial<ZonalySettings>;
  return { ...DEFAULT_SETTINGS, ...partial };
}

export function readSettings(): ZonalySettings {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return { ...DEFAULT_SETTINGS };
  try {
    return mergeWithDefaults(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings: ZonalySettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useSettings() {
  const [settings, setSettings] = useState<ZonalySettings>(readSettings);

  useEffect(() => {
    writeSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<ZonalySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, update };
}
