"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { CloseButton } from "@/components/ui/CloseButton";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * `"md"` (default, `max-w-dialog` = 28rem) fits every confirm/reject and
   * form dialog in the app. `"lg"` (`max-w-dialog-lg` = 56rem, M11.5) is only
   * for a detail view dense enough to need two columns on desktop — the order
   * detail is the first caller.
   */
  size?: "md" | "lg";
}

/**
 * `role="dialog"` + `aria-modal` + `aria-labelledby`, closes on Escape or
 * overlay click, traps focus while open and returns it to the trigger on
 * close (FRONTEND_GUIDELINES.md §5, DASHBOARD_GUIDELINES.md §8). Overlay is
 * the design system's overlay layer (`--color-overlay`, DESIGN_SYSTEM.md §4)
 * — no `box-shadow`, the surface change from base to card carries the depth.
 *
 * Three-strip flex column — title and footer `shrink-0`, body `min-h-0
 * flex-1 overflow-y-auto` — instead of one rigid block. A tall form (long
 * field lists, a template's growing "Etiquetas" section) used to push past
 * the viewport with no way to reach what got clipped; now only the body
 * scrolls, title and footer stay put. Horizontal padding lives inside the
 * scrolling body, not on the dialog shell: `overflow-y: auto` forces the X
 * axis to `auto` too, and a focus ring drawn 2px outside a control would
 * otherwise get clipped at the dialog's own edge.
 */
export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
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
        className={cn(
          "flex max-h-full w-full min-w-0 flex-col rounded-card-lg bg-surface focus:outline-none",
          size === "lg" ? "max-w-dialog-lg" : "max-w-dialog",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-sm px-lg pt-lg">
          <h2 id={titleId} className="font-display text-h3 text-negro">
            {title}
          </h2>
          <CloseButton onClick={onClose} aria-label={`Cerrar ${title}`} className="-mr-xs -mt-xs shrink-0" />
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-lg pt-md font-body text-body text-negro", !footer && "pb-lg")}>
          {children}
        </div>
        {footer ? <div className="flex shrink-0 justify-end gap-sm px-lg pb-lg pt-lg">{footer}</div> : null}
      </div>
    </div>
  );
}
