"use client";

import type { PriceCents } from "@bw-bikes/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MAX_COMPARISON_ENTRIES, MIN_COMPARISON_ENTRIES } from "./comparison-limits";

// Re-exported so every existing `from "./ComparisonProvider"` import keeps
// working — see `comparison-limits.ts` for why the values live there instead
// of here (a Server Component can't safely read a plain constant across a
// `"use client"` boundary).
export { MAX_COMPARISON_ENTRIES, MIN_COMPARISON_ENTRIES };

const STORAGE_KEY = "bw_comparison_selection";

/** The minimum a slot in `ComparisonTray` needs to paint itself without re-fetching — built straight from `PublicProductSummary` at the card, no round trip. */
export interface ComparisonEntry {
  slug: string;
  name: string;
  brandName: string;
  price: PriceCents;
  image?: { url: string; alt?: string };
}

interface ComparisonContextValue {
  entries: ComparisonEntry[];
  isSelected: (slug: string) => boolean;
  /** No-op once `MAX_COMPARISON_ENTRIES` is reached and `entry.slug` isn't already in — `CompareCheckbox` disables itself for exactly this case, but the guard lives here too so nothing else that calls `toggle` directly can bypass it. */
  toggle: (entry: ComparisonEntry) => void;
  remove: (slug: string) => void;
  clear: () => void;
  /** `false` until hydration from `sessionStorage` settles — lets `CompareCheckbox` avoid flashing an unchecked box that's actually selected. */
  ready: boolean;
}

const ComparisonContext = createContext<ComparisonContextValue | null>(null);

function readStoredEntries(): ComparisonEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ComparisonEntry =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ComparisonEntry).slug === "string" &&
        typeof (item as ComparisonEntry).name === "string" &&
        typeof (item as ComparisonEntry).brandName === "string" &&
        typeof (item as ComparisonEntry).price === "number",
    );
  } catch {
    // Malformed JSON or sessionStorage itself inaccessible (Safari private
    // browsing throws on access) — start from an empty selection rather than
    // let a corrupt value break the layout.
    return [];
  }
}

function writeStoredEntries(entries: ComparisonEntry[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Same inaccessible-storage case as the read side — the selection just
    // won't survive a hard navigation this visit, which is a degrade, not a
    // failure worth surfacing to the shopper.
  }
}

/**
 * The comparator's selection state (M-comparador): up to `MAX_COMPARISON_ENTRIES`
 * bikes, picked from `CompareCheckbox` on any catalog card and read by
 * `ComparisonTray`. Mounted in `(storefront)/layout.tsx` alongside
 * `WishlistProvider`, so the selection survives navigating from the grid to a
 * PDP and back.
 *
 * Persisted to `sessionStorage`, not `localStorage` — same criterion
 * `checkoutIdempotencyKey` already established for this app: the selection
 * belongs to this tab and this visit, not something that should outlive
 * closing it. Read once on mount (an effect, not `useState`'s lazy
 * initializer, so a server-rendered first paint and the client's first paint
 * agree before hydration reads storage) and written back on every change.
 */
export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ComparisonEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Reading `sessionStorage` genuinely has to wait for the client — the
    // server has no such thing, so this can't move to `useState`'s lazy
    // initializer. Calling `setEntries`/`setReady` directly at the top of the
    // effect body is exactly what `react-hooks/set-state-in-effect` flags;
    // `queueMicrotask` moves them out of the synchronous body — same pattern
    // `use-navbar-overlay.ts` uses. `cancelled` guards the (rare, but real)
    // unmount-before-microtask-runs race.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setEntries(readStoredEntries());
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Skip the very first render's write: it would overwrite a real stored
    // selection with `[]` in the single tick before the hydration effect
    // above runs.
    if (!ready) return;
    writeStoredEntries(entries);
  }, [entries, ready]);

  const isSelected = useCallback((slug: string) => entries.some((entry) => entry.slug === slug), [entries]);

  const toggle = useCallback((entry: ComparisonEntry) => {
    setEntries((current) => {
      if (current.some((existing) => existing.slug === entry.slug)) {
        return current.filter((existing) => existing.slug !== entry.slug);
      }
      if (current.length >= MAX_COMPARISON_ENTRIES) return current;
      return [...current, entry];
    });
  }, []);

  const remove = useCallback((slug: string) => {
    setEntries((current) => current.filter((entry) => entry.slug !== slug));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const value = useMemo<ComparisonContextValue>(
    () => ({ entries, isSelected, toggle, remove, clear, ready }),
    [entries, isSelected, toggle, remove, clear, ready],
  );

  return <ComparisonContext.Provider value={value}>{children}</ComparisonContext.Provider>;
}

export function useComparison(): ComparisonContextValue {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error("useComparison debe usarse dentro de ComparisonProvider.");
  }
  return context;
}
