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
  fixedCategoryId?: string;
}

/**
 * Mobile filter entry point — below `lg` (`CatalogFilterSidebar` covers
 * `lg` and up). Timing and a11y mechanics copy `MobileMenu.tsx` (panel
 * always mounted so `translate-y` has something to animate, `inert` while
 * closed, focus trap + Escape + body scroll lock, faster exit than entry);
 * unlike `MobileMenu`'s side drawer, this is a **bottom sheet** (Manuel's
 * call, 2026-08-28) — filters are a thumb-reachable utility panel over
 * content the shopper is still looking at, so it rises from the bottom
 * edge and caps at `max-h` instead of spanning the full viewport height.
 *
 * Renders as a fragment, not a wrapping `<div>` (2026-08-28): the trigger
 * lives in its own `sticky top-16` bar so it tracks scroll under the fixed
 * navbar (`specialized.com` mobile reference, Manuel), and `position: sticky`
 * plus a `z-index` opens a new stacking context — a scrim/panel nested
 * *inside* that box would paint under the navbar's own `z-30`. As siblings,
 * both stay in the root stacking context and their `z-30`/`z-40` behave the
 * same as before. Callers now render this as a direct child of the page's
 * outer wrapper, not inside the gutter column — see `bicicletas/page.tsx`.
 */
export function CatalogFilterDrawer({
  categoryTree,
  options,
  hideCategoryFilter,
  fixedCategoryId,
}: CatalogFilterDrawerProps) {
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
    <>
      {/* Full-bleed bar so it can read as one continuous strip while sticky —
          the gutter lives on the button's row, not the bar's background, so
          the bar covers the page's edge-to-edge width under the navbar. */}
      <div className="sticky top-16 z-20 border-b border-borde bg-blanco px-lg py-md sm:px-[clamp(2rem,8vw,8rem)] lg:hidden">
        <Button
          ref={toggleRef}
          variant="secondary"
          size="md"
          className="w-full"
          onClick={() => setOpen(true)}
          aria-expanded={isOpen}
          aria-controls="catalog-filter-drawer"
          iconLeft={<Funnel aria-hidden="true" className="text-dorado" />}
        >
          {/* The count's leading space has to be its own sibling text node,
              not the first character inside the span: the accessible-name
              algorithm trims each descendant element's own text before
              concatenating it, so a space living inside the span gets
              stripped and the name reads "Filtros(2)". */}
          {"Filtros"}
          {activeCount > 0 ? (
            <>
              {" "}
              <span className="text-dorado">({activeCount})</span>
            </>
          ) : null}
        </Button>
      </div>

      {isOpen ? (
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-negro/60 lg:hidden" />
      ) : null}

      <div
        ref={panelRef}
        id="catalog-filter-drawer"
        role="dialog"
        aria-modal={isOpen || undefined}
        aria-label="Filtros"
        inert={!isOpen ? true : undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col overflow-hidden rounded-t-card-lg lg:hidden",
          "border-t border-borde bg-surface",
          "transition-transform",
          isOpen ? "translate-y-0 duration-[260ms] ease-drawer" : "translate-y-full duration-200 ease-out-strong",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-borde px-lg">
          <span className="font-display text-h3 text-negro">Filtros</span>
          <CloseButton onClick={() => setOpen(false)} aria-label="Cerrar filtros" />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-lg py-md">
          <CatalogFilterGroups
            categoryTree={categoryTree}
            options={options}
            hideCategoryFilter={hideCategoryFilter}
            fixedCategoryId={fixedCategoryId}
          />
        </div>

        <div className="shrink-0 border-t border-borde p-lg">
          <Button variant="primary" size="md" className="w-full" onClick={() => setOpen(false)}>
            Ver resultados
          </Button>
        </div>
      </div>
    </>
  );
}
