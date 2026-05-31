import { useCallback, useRef, useState } from "react";

export type ToastVariant = "info" | "error";

export interface ToastState {
  visible: boolean;
  exiting: boolean;
  message: string;
  variant: ToastVariant;
  /** Optional action executed when the user clicks the toast. */
  onClickAction?: () => void;
}

const EXIT_DURATION = 320;

export function useToast(duration = 3000) {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    exiting: false,
    message: "",
    variant: "info",
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startExit = useCallback(() => {
    setToast((t) => ({ ...t, exiting: true }));
    exitRef.current = setTimeout(() => {
      setToast({ visible: false, exiting: false, message: "", variant: "info" });
    }, EXIT_DURATION);
  }, []);

  const show = useCallback((
    message: string,
    options?: { variant?: ToastVariant; duration?: number; onClickAction?: () => void }
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (exitRef.current)  clearTimeout(exitRef.current);
    setToast({
      visible: true,
      exiting: false,
      message,
      variant: options?.variant ?? "info",
      onClickAction: options?.onClickAction,
    });
    timerRef.current = setTimeout(startExit, options?.duration ?? duration);
  }, [duration, startExit]);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (exitRef.current)  clearTimeout(exitRef.current);
    startExit();
  }, [startExit]);

  return { toast, show, dismiss };
}
