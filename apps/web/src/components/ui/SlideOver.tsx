"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { CloseButton, type CloseButtonProps } from "@/components/ui/CloseButton";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { cn } from "@/lib/cn";

export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Secondary line under the title — an order number, a SKU, a status. */
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `icon` (admin default) or `icon-lg` — the storefront's cart drawer matches the 44px touch target the mobile nav's own toggle uses. */
  closeButtonSize?: CloseButtonProps["size"];
  /** Extra classes for the close button — the storefront's cart drawer adds the same `hover:!text-dorado` accent as the rest of the public nav. */
  closeButtonClassName?: string;
  /** Overrides the close button's glyph — the storefront's cart drawer passes its own animated icon; admin consumers leave this unset and keep the default Phosphor `X`. */
  closeButtonIcon?: ReactNode;
  /** Panel's max width. Default: the 480px `CustomerDetailDrawer` already uses — a denser detail (e.g. an order's) can widen it. */
  maxWidthClassName?: string;
  /** Rendered between the title block and the close button — the órdenes detail panel's prev/next row navigation, for example. Omit for the plain title/close header every other consumer uses. */
  headerAside?: ReactNode;
  /** `"side"` (default) is the edge-to-edge right-hand drawer. `"center"` keeps the same header/body/footer contract but centers the panel as a rounded, capped-height dialog instead — the órdenes detail panel uses it so a click-through row still reads as "one order at a time," not a drawer competing with the table underneath. */
  variant?: "side" | "center";
}

/**
 * Right-hand detail panel by default (480px, widen via `maxWidthClassName`)
 * — the component DASHBOARD_GUIDELINES.md §5 specs by name for the
 * "row → detail" pattern, and the reason a dense order detail doesn't have to
 * fit inside `Modal`'s 448px centered box. `variant="center"` keeps the same
 * header/body/footer contract but anchors the panel in the middle of the
 * screen as a rounded, capped-height dialog instead of a full-height edge
 * drawer — for a "one order at a time" detail view where the table
 * underneath shouldn't stay visible.
 *
 * Same accessibility contract as `Modal` deliberately (`role="dialog"` +
 * `aria-modal` + `aria-labelledby`, Escape and overlay click to close, focus
 * trapped while open and returned to the trigger on close) — the two share
 * `useFocusTrap`, so they can't drift apart on the part that matters.
 *
 * The difference that justifies a second component: the body scrolls
 * independently of the header and footer, so the actions stay reachable no
 * matter how long the order's line list and status history get.
 *
 * Flat by default (DESIGN_SYSTEM.md §4): the `base → surface` change plus the
 * left border carry the depth, never a `box-shadow`.
 */
export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  closeButtonSize,
  closeButtonClassName,
  closeButtonIcon,
  maxWidthClassName = "max-w-[480px]",
  headerAside,
  variant = "side",
}: SlideOverProps) {
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

  const centered = variant === "center";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-negro/60",
        centered ? "items-center justify-center p-md" : "justify-end",
      )}
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
          "flex w-full flex-col bg-surface focus:outline-none",
          centered ? "max-h-full overflow-hidden rounded-card-lg border border-borde" : "h-full border-l border-borde",
          maxWidthClassName,
        )}
      >
        <header className="flex items-start justify-between gap-md border-b border-borde px-lg py-md">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-h3 text-negro">
              {title}
            </h2>
            {subtitle ? <p className="mt-xs font-body text-caption text-grafito">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-start gap-sm">
            {headerAside}
            <CloseButton
              onClick={onClose}
              aria-label="Cerrar panel"
              size={closeButtonSize}
              className={cn("-mr-sm shrink-0", closeButtonClassName)}
              icon={closeButtonIcon}
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-lg py-md font-body text-body text-negro">{children}</div>

        {footer ? (
          <footer className="flex flex-wrap justify-end gap-sm border-t border-borde px-lg py-md">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
