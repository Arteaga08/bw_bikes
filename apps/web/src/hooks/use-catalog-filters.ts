"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  type CatalogFilterState,
  parseFilterState,
  serializeFilterState,
} from "@/lib/storefront-catalog-filters";

export interface UseCatalogFiltersResult {
  filters: CatalogFilterState;
  setFilters: (next: CatalogFilterState) => void;
}

/**
 * Mirrors the catalog filter sidebar's state onto the URL — the same
 * `useSearchParams` + `usePathname` + `useRouter` combination
 * `ProductEditor.tsx` uses for its `paso` param, with one deliberate
 * difference: `router.replace`, not `push`. Ticking a checkbox isn't a page
 * the visitor navigated to; "back" from the catalog should leave it, not
 * undo filters one click at a time.
 *
 * Requires a `<Suspense>` ancestor — `useSearchParams` opts the tree out of
 * static rendering otherwise (same requirement `ProductEditor` documents).
 */
export function useCatalogFilters(): UseCatalogFiltersResult {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseFilterState(searchParams), [searchParams]);

  const setFilters = useCallback(
    (next: CatalogFilterState) => {
      const query = serializeFilterState(next).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  return { filters, setFilters };
}
