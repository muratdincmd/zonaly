import { useEffect, useState } from "react";

const STORAGE_KEY = "zonaly.scale";
const MIN = 70;
const MAX = 150;
const STEP = 5;
const DEFAULT = 100;

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
    document.documentElement.style.setProperty(
      "--content-scale",
      String(scale / 100),
    );
    window.localStorage.setItem(STORAGE_KEY, String(scale));
  }, [scale]);

  const increase = () => setScale((s) => clamp(s + STEP));
  const decrease = () => setScale((s) => clamp(s - STEP));

  return { scale, increase, decrease };
}
