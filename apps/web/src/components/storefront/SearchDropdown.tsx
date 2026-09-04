"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { productHref } from "@/components/storefront/products/product-href";
import { Button, type ButtonTone } from "@/components/ui/Button";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchCatalog, type CatalogSearchResults } from "@/lib/api/catalog-search";
import type { PublicProductSummary } from "@/lib/api/public-catalog";
import { formatCurrencyCents } from "@/lib/format";

/** Same glyph size as `NavbarActions`'s Cuenta/Carrito icons — kept local since it's one number, not worth an export for. */
const ICON_SIZE = 28;

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

/**
 * The storefront navbar's "Buscar" — a dropdown anchored under its own
 * toggle button, same positioning (`relative` wrapper + `absolute top-full`)
 * and close-on-outside-click (`useClickOutside`) as `CatalogSortMenu`, not a
 * full-screen overlay like the admin `CommandPalette`.
 *
 * Queries both catalogs in parallel through `searchCatalog` (bikes +
 * accessories, matched server-side by name/SKU/brand) and renders each as its
 * own section, thumbnail first — the same visual language
 * `CatalogProductCard` uses for a product photo, scaled down to a 48px row.
 */
export function SearchDropdown({ tone }: { tone: ButtonTone }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSearchResults | null>(null);
  const [state, setState] = useState<SearchState>("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const pathname = usePathname();

  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);

  useClickOutside(containerRef, () => setOpen(false));

  // Fresh box every time it opens — same "adjust state during render"
  // pattern `CommandPalette`/`MobileMenu` use, not a `useEffect`: clearing
  // what was typed last time is a direct consequence of `open` flipping true.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setResults(null);
      setState("idle");
    }
  }

  // Closes on navigation, same pattern `MobileMenu` uses against `pathname`.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") setOpen(false);
  }

  const hasBikes = (results?.bikes.length ?? 0) > 0;
  const hasAccessories = (results?.accessories.length ?? 0) > 0;
  const hasResults = hasBikes || hasAccessories;

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <Button
        variant="bare"
        tone={tone}
        size="icon-lg"
        aria-label="Buscar"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((value) => !value)}
        iconLeft={<MagnifyingGlass style={{ width: ICON_SIZE, height: ICON_SIZE }} />}
        className="max-md:hidden hover:!text-dorado"
      />

      {open ? (
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
                        <SearchResultRow key={product.id} product={product} onNavigate={() => setOpen(false)} />
                      ))}
                    </ul>
                  </div>
                ) : null}
                {hasAccessories ? (
                  <div>
                    <p className="px-sm pb-xs font-ui text-eyebrow uppercase text-grafito">Accesorios</p>
                    <ul>
                      {results?.accessories.map((product) => (
                        <SearchResultRow key={product.id} product={product} onNavigate={() => setOpen(false)} />
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
      ) : null}
    </div>
  );
}
