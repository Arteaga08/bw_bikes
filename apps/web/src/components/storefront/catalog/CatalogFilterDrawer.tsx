"use client";

import type { PublicCatalogFilterOptions, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { Funnel } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CloseButton } from "@/components/ui/CloseButton";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { countActiveFilters } from "@/lib/storefront-catalog-filters";
import { CatalogFilterGroups } from "./CatalogFilterGroups";

export interface CatalogFilterDrawerProps {
  categoryTree: PublicCategoryTreeNode[];
  options: PublicCatalogFilterOptions;
  hideCategoryFilter?: boolean;
}

/**
 * Mobile filter entry point — below `lg` (`CatalogFilterSidebar` covers
 * `lg` and up). Timing and a11y mechanics copy `MobileMenu.tsx` (panel
 * always mounted so `translate-x` has something to animate, `inert` while
 * closed, focus trap + Escape + body scroll lock, faster exit than entry);
 * the entry edge follows `SlideOver`'s convention instead — filters are a
 * utility panel over content the shopper is still looking at, not a nav
 * drawer, so it opens from the **right**, not the left `MobileMenu` uses.
 */
export function CatalogFilterDrawer({ categoryTree, options, hideCategoryFilter }: CatalogFilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const { filters } = useCatalogFilters();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Tailwind's `lg` breakpoint is 1024px — "below lg" is its exact complement.
  const isBelowLg = useMediaQuery("(max-width: 1023px)");
  const isOpen = open && isBelowLg;

  useFocusTrap(panelRef, isOpen, toggleRef);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const activeCount = countActiveFilters(filters);

  return (
    <div className="lg:hidden">
      <Button
        ref={toggleRef}
        variant="ghost"
        tone="neutral"
        size="sm"
        onClick={() => setOpen(true)}
        aria-expanded={isOpen}
        aria-controls="catalog-filter-drawer"
        iconLeft={<Funnel aria-hidden="true" />}
      >
        Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
      </Button>

      {isOpen ? (
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-negro/60" />
      ) : null}

      <div
        ref={panelRef}
        id="catalog-filter-drawer"
        role="dialog"
        aria-modal={isOpen || undefined}
        aria-label="Filtros"
        inert={!isOpen ? true : undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-80 max-w-[calc(100vw-3.5rem)] flex-col",
          "border-l border-borde bg-surface",
          "transition-transform",
          isOpen ? "translate-x-0 duration-[260ms] ease-drawer" : "translate-x-full duration-200 ease-out-strong",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-borde px-lg">
          <span className="font-display text-h3 text-negro">Filtros</span>
          <CloseButton onClick={() => setOpen(false)} aria-label="Cerrar filtros" />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-lg py-md">
          <CatalogFilterGroups categoryTree={categoryTree} options={options} hideCategoryFilter={hideCategoryFilter} />
        </div>

        <div className="shrink-0 border-t border-borde p-lg">
          <Button variant="primary" size="md" className="w-full" onClick={() => setOpen(false)}>
            Ver resultados
          </Button>
        </div>
      </div>
    </div>
  );
}
