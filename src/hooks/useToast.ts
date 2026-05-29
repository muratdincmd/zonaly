import { useCallback, useRef, useState } from "react";

export interface ToastState {
  visible: boolean;
  exiting: boolean;
  message: string;
}

const EXIT_DURATION = 320; // ms — must match CSS animation duration

export function useToast(duration = 3000) {
  const [toast, setToast] = useState<ToastState>({ visible: false, exiting: false, message: "" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startExit = useCallback(() => {
    setToast((t) => ({ ...t, exiting: true }));
    exitRef.current = setTimeout(() => {
      setToast({ visible: false, exiting: false, message: "" });
    }, EXIT_DURATION);
  }, []);

  const show = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (exitRef.current)  clearTimeout(exitRef.current);
    setToast({ visible: true, exiting: false, message });
    timerRef.current = setTimeout(startExit, duration);
  }, [duration, startExit]);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (exitRef.current)  clearTimeout(exitRef.current);
    startExit();
  }, [startExit]);

  return { toast, show, dismiss };
}
