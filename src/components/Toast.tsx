import type { ToastState } from "../hooks/useToast";

interface Props {
  toast: ToastState;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: Props) {
  if (!toast.visible) return null;

  return (
    <div
      className="toast"
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      <svg
        className="toast-icon"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z" />
        <line x1="8" y1="5" x2="8" y2="8" />
        <line x1="8" y1="11" x2="8" y2="11" />
      </svg>
      <span>{toast.message}</span>
    </div>
  );
}
