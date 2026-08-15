"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useRef } from "react";
import { cn } from "@/lib/cn";

export interface TabListProps {
  /** Names the set for assistive tech — "Vistas de órdenes". */
  label: string;
  children: ReactNode;
  className?: string;
}

export interface TabProps {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  /** Count or status shown after the label, in `grafito` so it never competes with the label itself. */
  badge?: ReactNode;
  /** Pair with `panelId` to link the tab to the region it controls; the consumer renders that region with `role="tabpanel"` and `aria-labelledby={id}`. */
  id?: string;
  panelId?: string;
}

/**
 * Tab strip for switching the *content below it* — not for navigating to
 * another URL. A tab that changes the route is a link and belongs in the
 * breadcrumb/nav vocabulary instead.
 *
 * Keyboard behavior follows the WAI-ARIA tabs pattern: one stop in the tab
 * order (only the selected tab is focusable), then Left/Right/Home/End move
 * between tabs and select as they go. `OrdersView` shipped these as plain
 * buttons marked `aria-current`, which is navigation semantics — a screen
 * reader announced "current page" for a control that changes a table in place.
 */
export function TabList({ label, children, className }: TabListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    const tabs = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? []);
    const current = tabs.findIndex((tab) => tab === document.activeElement);
    if (tabs.length === 0 || current === -1) return;

    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else next = (current + 1) % tabs.length;

    event.preventDefault();
    // Focus moves and selection follows it — the pattern's "automatic
    // activation", correct here because switching a tab is cheap and has no
    // side effect the user has to opt into.
    tabs[next]?.focus();
    tabs[next]?.click();
  }, []);

  return (
    <div className={cn("border-b border-borde", className)}>
      <div ref={listRef} role="tablist" aria-label={label} onKeyDown={handleKeyDown} className="flex gap-lg">
        {children}
      </div>
    </div>
  );
}

export function Tab({ selected, onSelect, children, badge, id, panelId }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={panelId}
      // Roving tabindex: the strip is a single Tab stop, arrows move within it.
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        // -mb-px pulls the 2px indicator over the list's own hairline so the
        // selected tab's underline replaces it instead of stacking on top.
        "-mb-px inline-flex items-center gap-xs border-b-2 py-md font-ui text-ui transition-colors duration-150",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
        selected ? "border-negro text-negro" : "border-transparent text-grafito hover:text-negro",
      )}
    >
      {children}
      {/* The gap between label and badge is a flex `gap`, which draws no text —
          without this space the accessible name computes as "Cola de
          proveedor3". A whitespace-only node between flex items is dropped
          from layout, so it costs nothing visually. */}
      {badge ? " " : null}
      {badge ? <span className="font-ui text-caption text-grafito">{badge}</span> : null}
    </button>
  );
}
