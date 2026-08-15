"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CloseButton } from "@/components/ui/CloseButton";
import { cn } from "@/lib/cn";

export type ToastVariant = "success" | "info" | "warning" | "error";

export interface ToastOptions {
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// error stays until dismissed by hand — an operational mistake (a failed
// payment capture, a rejected supplier confirmation) shouldn't vanish from
// the screen on a timer.
const AUTO_DISMISS_MS: Record<ToastVariant, number | null> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: null,
};

const MAX_VISIBLE = 3;

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-estado-exito text-estado-exito",
  info: "border-negro text-negro",
  warning: "border-estado-advertencia text-estado-advertencia",
  error: "border-estado-error text-estado-error",
};

/**
 * Top-right stack, max 3 at a time, `aria-live="polite"` container so
 * screen readers announce each toast as it's added (FRONTEND_GUIDELINES.md
 * §5). Flat by design — border + surface background carry the emphasis,
 * never a `box-shadow` (DESIGN_SYSTEM.md §4's Flat-By-Default rule).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...options, id }].slice(-MAX_VISIBLE));

      const duration = AUTO_DISMISS_MS[options.variant];
      if (duration !== null) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-md right-md left-md z-[60] flex w-auto flex-col gap-sm pt-[env(safe-area-inset-top)] sm:left-auto sm:w-80"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn("rounded-card border bg-surface p-md", VARIANT_CLASSES[item.variant])}
          >
            <div className="flex items-start justify-between gap-sm">
              <div>
                <p className="font-ui text-ui text-negro">{item.title}</p>
                {item.description ? (
                  <p className="mt-xs font-body text-caption text-grafito">{item.description}</p>
                ) : null}
              </div>
              <CloseButton onClick={() => dismiss(item.id)} aria-label="Cerrar notificación" className="-mr-xs -mt-xs shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de un ToastProvider.");
  }
  return ctx;
}
