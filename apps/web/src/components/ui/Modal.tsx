"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * `role="dialog"` + `aria-modal` + `aria-labelledby`, closes on Escape or
 * overlay click, traps focus while open and returns it to the trigger on
 * close (FRONTEND_GUIDELINES.md §5, DASHBOARD_GUIDELINES.md §8). Overlay is
 * the design system's overlay layer (`--color-overlay`, DESIGN_SYSTEM.md §4)
 * — no `box-shadow`, the surface change from base to card carries the depth.
 */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(containerRef, open);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-negro/60 p-md"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={stopPropagation}
        className="w-full max-w-dialog rounded-card-lg bg-surface p-lg focus:outline-none"
      >
        <h2 id={titleId} className="font-display text-h3 text-negro">
          {title}
        </h2>
        <div className="mt-md font-body text-body text-negro">{children}</div>
        {footer ? <div className="mt-lg flex justify-end gap-sm">{footer}</div> : null}
      </div>
    </div>
  );
}
