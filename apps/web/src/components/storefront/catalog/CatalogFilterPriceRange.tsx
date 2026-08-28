"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { centsToPesosInput, pesosInputToCents } from "@/lib/storefront-catalog-filters";

export interface CatalogFilterPriceRangeProps {
  minPrice: number | undefined;
  maxPrice: number | undefined;
  /** The catalog's real min/max (integer cents) — shown as placeholders so a shopper has a sense of scale before typing anything. */
  bounds: { min: number; max: number } | null;
  onChange: (minPrice: number | undefined, maxPrice: number | undefined) => void;
}

const DEBOUNCE_MS = 500;

/**
 * "Desde"/"Hasta" in whole pesos — `pesosInputToCents`/`centsToPesosInput`
 * (`lib/storefront-catalog-filters.ts`) are the one place the peso↔cents
 * conversion happens. Debounced so a shopper typing "2" then "0" then "0"
 * then "0" doesn't fire three `router.replace` calls before landing on
 * "2000" — only the pause after typing stops writes to the URL.
 */
export function CatalogFilterPriceRange({ minPrice, maxPrice, bounds, onChange }: CatalogFilterPriceRangeProps) {
  const [minInput, setMinInput] = useState(() => centsToPesosInput(minPrice));
  const [maxInput, setMaxInput] = useState(() => centsToPesosInput(maxPrice));

  // Follows external resets (e.g. "Limpiar filtros", or the browser's own
  // back/forward through the URL) — adjusted during render, the same
  // "derive state from a changed prop" pattern `MobileMenu` uses to close on
  // navigation, rather than an effect (React flags a same-component
  // `setState` inside `useEffect` as an avoidable extra render pass).
  const [prevMinPrice, setPrevMinPrice] = useState(minPrice);
  if (minPrice !== prevMinPrice) {
    setPrevMinPrice(minPrice);
    setMinInput(centsToPesosInput(minPrice));
  }
  const [prevMaxPrice, setPrevMaxPrice] = useState(maxPrice);
  if (maxPrice !== prevMaxPrice) {
    setPrevMaxPrice(maxPrice);
    setMaxInput(centsToPesosInput(maxPrice));
  }

  const debouncedMin = useDebouncedValue(minInput, DEBOUNCE_MS);
  const debouncedMax = useDebouncedValue(maxInput, DEBOUNCE_MS);

  // Skips the mount: without this guard, a price with centavos (e.g. 1999)
  // would round-trip through the whole-peso inputs to 2000 and fire
  // `onChange` before the shopper touched anything, silently rewriting the
  // URL on load.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    onChange(pesosInputToCents(debouncedMin), pesosInputToCents(debouncedMax));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the debounced values should retrigger this
  }, [debouncedMin, debouncedMax]);

  return (
    <div className="flex items-end gap-sm">
      <Input
        label="Desde"
        type="number"
        min={0}
        inputMode="numeric"
        placeholder={bounds ? centsToPesosInput(bounds.min) : undefined}
        value={minInput}
        onChange={(event) => setMinInput(event.target.value)}
        wrapperClassName="min-w-0 flex-1"
      />
      <Input
        label="Hasta"
        type="number"
        min={0}
        inputMode="numeric"
        placeholder={bounds ? centsToPesosInput(bounds.max) : undefined}
        value={maxInput}
        onChange={(event) => setMaxInput(event.target.value)}
        wrapperClassName="min-w-0 flex-1"
      />
    </div>
  );
}
