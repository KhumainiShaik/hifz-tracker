import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, X, AlertCircle } from "lucide-react";
import { ToastContext } from "./state";
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    id: number;
    text: string;
    error: boolean;
  } | null>(null);
  const show = useCallback((text: string, error = false) => {
    const id = Date.now();
    setToast({ id, text, error });
    window.setTimeout(
      () => setToast((t) => (t?.id === id ? null : t)),
      error ? 12000 : 6500,
    );
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" aria-atomic="true">
        {toast && (
          <div
            className={`toast ${toast.error ? "toast-error" : ""}`}
            role={toast.error ? "alert" : "status"}
          >
            {toast.error ? (
              <AlertCircle size={20} />
            ) : (
              <CheckCircle2 size={20} />
            )}
            <span>{toast.text}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
