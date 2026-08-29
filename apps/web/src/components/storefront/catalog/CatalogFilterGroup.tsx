"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useId, useLayoutEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CatalogFilterGroupProps {
  title: string;
  /** Starts expanded — used for the groups a shopper is most likely to act on first (Categoría, Marca). */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * One collapsible section of the filter sidebar. Same mechanism as
 * `NavAccordionItem` (`grid-template-rows: 0fr→1fr` on a single-row grid
 * whose only child is `overflow-hidden`, `inert` while collapsed) — it
 * animates to/from the content's natural height without measuring it in JS,
 * and `inert` keeps a collapsed group's checkboxes out of the Tab order
 * instead of merely hiding them visually.
 */
export function CatalogFilterGroup({ title, defaultOpen = false, children }: CatalogFilterGroupProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const panelId = useId();

  // Next.js preserves this component's state across back/forward navigation
  // (client-side back/forward cache — see `staleTimes.md` in the local Next
  // docs). Without this, leaving the catalog with a group expanded and
  // coming back restores it exactly as it was instead of Manuel's requested
  // fresh state.
  useLayoutEffect(() => {
    return () => {
      setExpanded(defaultOpen);
    };
  }, [defaultOpen]);

  return (
    <div className="border-b border-borde py-md first:pt-0 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-sm text-left text-negro"
      >
        <span className="font-ui text-ui font-medium uppercase tracking-wide">{title}</span>
        <CaretDown
          aria-hidden="true"
          size={16}
          className={cn("shrink-0 transition-transform duration-200 ease-out-strong", expanded && "rotate-180")}
        />
      </button>

      <div
        id={panelId}
        inert={!expanded ? true : undefined}
        className="grid transition-[grid-template-rows] duration-200 ease-out-strong"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="pt-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
