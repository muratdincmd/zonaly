import { useCallback, useRef, useState } from "react";

export interface ToastState {
  visible: boolean;
  message: string;
}

export function useToast(duration = 3000) {
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ visible: true, message });
    timerRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, duration);
  }, [duration]);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  return { toast, show, dismiss };
}
