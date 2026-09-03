"use client";

import { CaretUp } from "@phosphor-icons/react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CloseButton } from "@/components/ui/CloseButton";
import { cn } from "@/lib/cn";
import { formatCurrencyCentsWithCurrency } from "@/lib/format";
import { MAX_COMPARISON_ENTRIES, MIN_COMPARISON_ENTRIES, useComparison, type ComparisonEntry } from "./ComparisonProvider";

/** The CSS variable `body`'s own `padding-bottom` reads (`globals.css`) — set here so the tray never overlaps the last row of catalog cards, cleared on unmount/close so a page without the tray isn't left with dead padding. */
const TRAY_HEIGHT_VAR = "--comparison-tray-height";

function ComparisonSlot({ entry, onRemove }: { entry: ComparisonEntry; onRemove: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-sm">
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-control bg-blanco">
        {entry.image ? (
          <Image src={entry.image.url} alt={entry.image.alt ?? entry.name} fill sizes="80px" className="object-contain" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-caption uppercase text-grafito">{entry.brandName}</p>
        <p className="truncate font-body text-body text-negro">{entry.name}</p>
        <p className="font-body text-caption text-grafito">{formatCurrencyCentsWithCurrency(entry.price)}</p>
      </div>
      <CloseButton
        aria-label={`Quitar ${entry.name} de la comparación`}
        size="icon-sm"
        onClick={onRemove}
        className="shrink-0"
      />
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-control border border-dashed border-borde px-md py-lg">
      <p className="font-body text-caption text-grafito">Agrega otra bicicleta</p>
    </div>
  );
}

/**
 * The comparator's selection tray (M-comparador): a fixed bottom bar that
 * accumulates up to `MAX_COMPARISON_ENTRIES` bikes picked from
 * `CompareCheckbox` on the catalog grid, and hands the pair (or trio) off to
 * `/comparar`. Mounted once in `(storefront)/layout.tsx`, next to
 * `CartDrawer` — it has to be reachable from any catalog page, not just one.
 *
 * Deliberately **not a dialog**: no focus trap, no scroll lock, no
 * `role="dialog"`. The shopper is meant to keep browsing the grid with the
 * tray up — it's a persistent utility bar, closer to a shopping cart summary
 * than a modal. `role="region"` plus a visually-hidden `aria-live` region
 * announces the running count without stealing focus.
 *
 * Always mounted (even with zero entries) so the `translate-y` transition
 * has something to animate from — same mechanic `CatalogFilterDrawer` uses
 * for its bottom sheet, minus that one's modal semantics. `inert` while
 * closed keeps its (empty, off-screen) contents out of the tab order.
 *
 * Hidden (not unmounted, not cleared) on `/comparar` itself: the shopper just
 * landed on the side-by-side spec sheet the tray's own "Comparar" button
 * sent them to, so the tray re-showing its own selection there is noise, not
 * help. The selection stays in `sessionStorage` — `ComparisonProvider` never
 * hears about the route — so it's back the moment they return to a catalog
 * page, still checked in `CompareCheckbox`.
 */
export function ComparisonTray() {
  const { entries, remove, clear, ready } = useComparison();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);

  const isOpen = ready && entries.length > 0 && pathname !== "/comparar";
  const canCompare = entries.length >= MIN_COMPARISON_ENTRIES;

  // Collapse the mobile panel whenever the tray closes (selection cleared) —
  // otherwise picking a fresh first bike later would reopen mid-expanded.
  // `queueMicrotask` for the same reason as `ComparisonProvider`'s hydration
  // effect: calling `setMobileExpanded` straight from the effect body is what
  // `react-hooks/set-state-in-effect` flags.
  useEffect(() => {
    if (isOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMobileExpanded(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Measures the tray's real rendered height (it varies: 1 vs. 3 slots, the
  // mobile panel expanded or not) and republishes it as a CSS variable
  // `globals.css` reads on `body`'s `padding-bottom` — one write site instead
  // of every catalog page reserving space for a bar it may not know exists.
  useEffect(() => {
    const node = trayRef.current;
    if (!isOpen || !node) {
      document.documentElement.style.removeProperty(TRAY_HEIGHT_VAR);
      return;
    }

    function publish(): void {
      if (node) document.documentElement.style.setProperty(TRAY_HEIGHT_VAR, `${node.offsetHeight}px`);
    }

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(TRAY_HEIGHT_VAR);
    };
  }, [isOpen, mobileExpanded]);

  function handleCompare(): void {
    const slugs = entries.map((entry) => entry.slug).join(",");
    router.push(`/comparar?bicis=${encodeURIComponent(slugs)}`);
  }

  const placeholderCount = Math.max(0, MAX_COMPARISON_ENTRIES - entries.length);

  return (
    <div
      ref={trayRef}
      role="region"
      aria-label="Comparación"
      inert={!isOpen ? true : undefined}
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-surface pb-[env(safe-area-inset-bottom)]",
        "transition-transform",
        isOpen ? "translate-y-0 duration-[260ms] ease-drawer" : "translate-y-full duration-200 ease-out-strong",
      )}
    >
      {/* Announced on every change, never read visually — the slots and the
          "Comparar (N)" label already say this on screen. */}
      <span className="sr-only" aria-live="polite">
        {entries.length} de {MAX_COMPARISON_ENTRIES} bicicletas seleccionadas
      </span>

      {/* Mobile (< sm): one compact row — thumbnails, count, both actions.
          Tapping the thumbnail/count group expands the full slots below;
          the actions stay reachable without expanding first. */}
      <div className="flex items-center justify-between gap-sm px-lg py-sm sm:hidden">
        <button
          type="button"
          onClick={() => setMobileExpanded((current) => !current)}
          aria-expanded={mobileExpanded}
          aria-label={`${entries.length} de ${MAX_COMPARISON_ENTRIES} bicicletas seleccionadas — ${mobileExpanded ? "ocultar" : "ver"} selección`}
          className="flex min-w-0 items-center gap-xs"
        >
          <span className="flex -space-x-2">
            {entries.map((entry) => (
              <span key={entry.slug} className="relative h-8 w-8 overflow-hidden rounded-control border-2 border-surface bg-blanco">
                {entry.image ? (
                  <Image src={entry.image.url} alt="" fill sizes="32px" className="object-contain" />
                ) : null}
              </span>
            ))}
          </span>
          <span className="truncate font-body text-caption text-grafito">
            {entries.length} de {MAX_COMPARISON_ENTRIES}
          </span>
          <CaretUp
            aria-hidden="true"
            weight="bold"
            className={cn("size-3 shrink-0 text-grafito transition-transform duration-150", mobileExpanded && "rotate-180")}
          />
        </button>

        <div className="flex shrink-0 items-center gap-xs">
          <Button variant="text" size="sm" onClick={clear}>
            Limpiar
          </Button>
          <Button variant="primary" size="sm" disabled={!canCompare} onClick={handleCompare}>
            Comparar ({entries.length})
          </Button>
        </div>
      </div>

      {mobileExpanded ? (
        <div className="flex flex-col gap-sm border-t border-borde px-lg py-md sm:hidden">
          {entries.map((entry) => (
            <ComparisonSlot key={entry.slug} entry={entry} onRemove={() => remove(entry.slug)} />
          ))}
          {Array.from({ length: placeholderCount }, (_, index) => (
            <EmptySlot key={index} />
          ))}
        </div>
      ) : null}

      {/* Desktop / tablet (sm+): every slot and both actions in one row. */}
      <div className="hidden items-center gap-lg px-lg py-md sm:flex">
        <div className="flex flex-1 items-center gap-lg">
          {entries.map((entry) => (
            <ComparisonSlot key={entry.slug} entry={entry} onRemove={() => remove(entry.slug)} />
          ))}
          {Array.from({ length: placeholderCount }, (_, index) => (
            <EmptySlot key={index} />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-sm">
          <Button variant="text" onClick={clear}>
            Limpiar selección
          </Button>
          <Button variant="primary" disabled={!canCompare} onClick={handleCompare}>
            Comparar ({entries.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
