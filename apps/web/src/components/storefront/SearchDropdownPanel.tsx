"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { productHref } from "@/components/storefront/products/product-href";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchCatalog, type CatalogSearchResults } from "@/lib/api/catalog-search";
import type { PublicProductSummary } from "@/lib/api/public-catalog";
import { formatCurrencyCents } from "@/lib/format";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

type SearchState = "idle" | "loading" | "error";

function SearchResultRow({ product, onNavigate }: { product: PublicProductSummary; onNavigate: () => void }) {
  const [image] = product.gallery;

  return (
    <li>
      <Link
        href={productHref(product)}
        onClick={onNavigate}
        role="option"
        aria-selected="false"
        className="flex items-center gap-sm rounded-control px-sm py-sm text-left transition-colors duration-150 hover:bg-base"
      >
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-control bg-blanco">
          {image ? (
            <Image src={image.url} alt={image.alt ?? product.name} fill sizes="48px" className="object-contain" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-ui text-ui text-negro">{product.name}</span>
          <span className="block font-body text-caption text-grafito">{formatCurrencyCents(product.price)}</span>
        </span>
      </Link>
    </li>
  );
}

export interface SearchDropdownPanelProps {
  /** Wired to the toggle's `aria-controls` in `SearchDropdown` — the listbox has to carry the id the button points at. */
  listboxId: string;
  /** Closes the dropdown after a result is picked. */
  onNavigate: () => void;
}

/**
 * The open state of `SearchDropdown`: the input, the debounced query against
 * both catalogs, and the two result sections.
 *
 * Split out so it can be `next/dynamic`'d — the toggle button ships on every
 * public route, but the search box behind it only matters after a click, and
 * pulling it out takes `searchCatalog`, `useDebouncedValue` and the result-row
 * rendering with it.
 *
 * This component only exists while the dropdown is open, which is what resets
 * the box between openings: `SearchDropdown` used to clear `query`/`results`
 * by hand when `open` flipped, because that state lived one level up. Now
 * unmounting does it.
 */
export function SearchDropdownPanel({ listboxId, onNavigate }: SearchDropdownPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSearchResults | null>(null);
  const [state, setState] = useState<SearchState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Same "adjust state during render" idiom `BadgesView`/`SpecTemplatesView`
  // use ahead of their own debounced-search effect: flipping into "loading"
  // (or, below the minimum length, straight back to "idle" with no results)
  // is a direct consequence of `debouncedQuery` changing, not a sync with an
  // external system — keeping it here (rather than as the first lines of the
  // effect below) is what keeps that effect's body free of any *synchronous*
  // `setState`, all of it deferred to the fetch's own callbacks.
  const [lastQuery, setLastQuery] = useState(debouncedQuery);
  if (debouncedQuery !== lastQuery) {
    setLastQuery(debouncedQuery);
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setState("idle");
    } else {
      setState("loading");
    }
  }

  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) return;

    let cancelled = false;
    searchCatalog(debouncedQuery)
      .then((data) => {
        if (cancelled) return;
        setResults(data);
        setState("idle");
      })
      .catch(() => {
        if (cancelled) return;
        setResults(null);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hasBikes = (results?.bikes.length ?? 0) > 0;
  const hasAccessories = (results?.accessories.length ?? 0) > 0;
  const hasResults = hasBikes || hasAccessories;

  return (
    <div className="absolute right-0 top-full z-40 mt-xs w-80 rounded-card border border-borde bg-surface p-sm">
      <div className="flex items-center gap-sm border-b border-borde px-xs pb-sm">
        <MagnifyingGlass size={18} className="shrink-0 text-grafito" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar bicicletas o accesorios…"
          aria-label="Buscar bicicletas o accesorios"
          autoComplete="off"
          className="w-full font-body text-body text-negro outline-none placeholder:text-grafito"
        />
      </div>

      <div id={listboxId} role="listbox" aria-label="Resultados de búsqueda" className="mt-sm max-h-96 overflow-y-auto">
        {state === "loading" ? (
          <p className="px-sm py-md font-body text-body text-grafito">Buscando…</p>
        ) : state === "error" ? (
          <p className="px-sm py-md font-body text-body text-grafito">
            No pudimos completar la búsqueda. Intenta de nuevo.
          </p>
        ) : debouncedQuery.length < MIN_QUERY_LENGTH ? (
          <p className="px-sm py-md font-body text-body text-grafito">Sigue escribiendo para buscar…</p>
        ) : hasResults ? (
          <>
            {hasBikes ? (
              <div className="mb-sm">
                <p className="px-sm pb-xs font-ui text-eyebrow uppercase text-grafito">Bicicletas</p>
                <ul>
                  {results?.bikes.map((product) => (
                    <SearchResultRow key={product.id} product={product} onNavigate={onNavigate} />
                  ))}
                </ul>
              </div>
            ) : null}
            {hasAccessories ? (
              <div>
                <p className="px-sm pb-xs font-ui text-eyebrow uppercase text-grafito">Accesorios</p>
                <ul>
                  {results?.accessories.map((product) => (
                    <SearchResultRow key={product.id} product={product} onNavigate={onNavigate} />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className="px-sm py-md font-body text-body text-grafito">
            No encontramos resultados para &ldquo;{debouncedQuery}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
