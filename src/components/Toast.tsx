import type { ToastState } from "../hooks/useToast";

interface Props {
  toast: ToastState;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: Props) {
  if (!toast.visible) return null;

  const handleClick = () => {
    toast.onClickAction?.();
    onDismiss();
  };

  const isError = toast.variant === "error";

  return (
    <div
      className={`toast${toast.exiting ? " toast--exit" : ""}${isError ? " toast--error" : ""}${toast.onClickAction ? " toast--clickable" : ""}`}
      role="status"
      aria-live="polite"
      onClick={handleClick}
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
        {isError ? (
          <>
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z" />
            <line x1="8" y1="5" x2="8" y2="9" />
            <line x1="8" y1="11" x2="8" y2="11" />
          </>
        ) : (
          <>
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z" />
            <polyline points="5,8 7,10 11,6" />
          </>
        )}
      </svg>
      <span>{toast.message}</span>
      {toast.onClickAction && (
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          aria-hidden="true" className="toast-arrow"
        >
          <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}
