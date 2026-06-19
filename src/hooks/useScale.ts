import { useEffect, useState } from "react";

const STORAGE_KEY = "zonaly.scale";
const MIN = 70;
const MAX = 150;
const STEP = 5;
const DEFAULT = 100;
// Base font size browsers default to — we scale relative to this.
const BASE_PX = 16;

function clamp(v: number) {
  return Math.min(MAX, Math.max(MIN, v));
}

function readStored(): number {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT;
  const n = parseInt(raw, 10);
  return isNaN(n) ? DEFAULT : clamp(n);
}

export function useScale() {
  const [scale, setScale] = useState<number>(readStored);

  useEffect(() => {
    // Set font-size on <html> so all rem-based sizes (text, spacing, icons)
    // scale together while px-based layout widths stay fixed.
    document.documentElement.style.fontSize = `${(BASE_PX * scale) / 100}px`;
    window.localStorage.setItem(STORAGE_KEY, String(scale));
  }, [scale]);

  const increase = () => setScale((s) => clamp(s + STEP));
  const decrease = () => setScale((s) => clamp(s - STEP));

  return { scale, increase, decrease };
}
