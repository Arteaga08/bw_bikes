"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";
import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/cn";

/**
 * The six `sort` values the storefront's "Ordenar por" control exposes.
 * `-isNewArrival`/`-isCustomerFavorite` are compound aliases the API resolves
 * server-side (`SORT_ALIASES` in `product.service.ts`) — the reference
 * design's "Más relevantes"/"Más vendidos" have no backing data (no
 * relevance score, no sales count), so Manuel's call was to fill those two
 * slots with the merchandising flags the catalog already has instead.
 * "Características" and both "Fecha" options from the reference are
 * deliberately excluded — Manuel's call, this menu only lists what's left.
 */
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "-isNewArrival", label: "Novedades primero" },
  { value: "-isCustomerFavorite", label: "Favoritas primero" },
  { value: "name", label: "Alfabéticamente, A-Z" },
  { value: "-name", label: "Alfabéticamente, Z-A" },
  { value: "price", label: "Precio, menor a mayor" },
  { value: "-price", label: "Precio, mayor a menor" },
];

/**
 * "Ordenar por" — a hand-rolled radio panel anchored the same way `Menu`/
 * `HelpPopover` do (`relative` wrapper + `absolute top-full`; the project has
 * no floating-position library). Reads and writes `CatalogFilterState.sort`
 * through `useCatalogFilters`, the same hook the filter sidebar uses — since
 * `setFilters` re-serializes the *whole* state (never just `sort`), changing
 * the order also drops `page` from the URL for free, landing the shopper back
 * on page 1 instead of an out-of-range page in the new order.
 *
 * A real `<fieldset>`/`role="radio"` group, not a button list, so arrow-key
 * navigation and the screen-reader "N of 6" announcement come from native
 * semantics instead of hand-rolled roving `tabIndex`.
 */
export function CatalogSortMenu() {
  const { filters, setFilters } = useCatalogFilters();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useClickOutside(containerRef, () => setOpen(false));

  // Next.js preserves this component's state across back/forward navigation
  // (client-side back/forward cache — see `staleTimes.md` in the local Next
  // docs). Without this, leaving the catalog with the menu open and coming
  // back reopens it exactly as it was — a transient dropdown, not a view the
  // shopper meant to keep set up.
  useLayoutEffect(() => {
    return () => {
      setOpen(false);
    };
  }, []);

  const selected = SORT_OPTIONS.find((option) => option.value === filters.sort);

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") setOpen(false);
  }

  function selectSort(value: string): void {
    setFilters({ ...filters, sort: value });
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-xs font-ui text-ui font-medium text-negro"
      >
        {selected ? `Ordenar por: ${selected.label}` : "Ordenar por"}
        <CaretDown
          aria-hidden="true"
          size={16}
          className={cn("shrink-0 transition-transform duration-200 ease-out-strong", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute top-full left-0 z-20 mt-xs w-64 rounded-card border border-borde bg-surface p-xs"
        >
          <fieldset>
            <legend className="sr-only">Ordenar por</legend>
            <ul>
              {SORT_OPTIONS.map((option) => (
                <li key={option.value}>
                  <label className="flex cursor-pointer items-center gap-sm rounded-control px-sm py-sm transition-colors duration-150 hover:bg-base">
                    <span className="relative inline-flex shrink-0">
                      <input
                        type="radio"
                        name="catalog-sort"
                        value={option.value}
                        checked={filters.sort === option.value}
                        onChange={() => selectSort(option.value)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-borde",
                          "transition-colors duration-150 peer-checked:border-negro",
                          "peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-negro",
                        )}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full bg-negro opacity-0 transition-opacity duration-150",
                            filters.sort === option.value && "opacity-100",
                          )}
                        />
                      </span>
                    </span>
                    <span className="font-ui text-ui text-negro">{option.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}
