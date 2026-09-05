"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Button, type ButtonTone } from "@/components/ui/Button";
import { useClickOutside } from "@/hooks/use-click-outside";

/**
 * The dropdown's contents load on first open. No `loading` fallback and no
 * layout to reserve: the panel is `absolute`-positioned over the page, so a
 * frame without it costs nothing but the panel itself — and unlike the mobile
 * drawer, it has no entry transition that a late mount could swallow.
 */
const SearchDropdownPanel = dynamic(
  () => import("@/components/storefront/SearchDropdownPanel").then((mod) => mod.SearchDropdownPanel),
  { ssr: false },
);

/** Same glyph size as `NavbarActions`'s Cuenta/Carrito icons — kept local since it's one number, not worth an export for. */
const ICON_SIZE = 28;

/**
 * The storefront navbar's "Buscar" — a dropdown anchored under its own
 * toggle button, same positioning (`relative` wrapper + `absolute top-full`)
 * and close-on-outside-click (`useClickOutside`) as `CatalogSortMenu`, not a
 * full-screen overlay like the admin `CommandPalette`.
 *
 * Only the toggle and the open/closed state live here; the input, the
 * debounced catalog query and the result list are in `SearchDropdownPanel`,
 * loaded on demand (M-optimización). Queries both catalogs in parallel
 * through `searchCatalog` (bikes + accessories, matched server-side by
 * name/SKU/brand) and renders each as its own section, thumbnail first — the
 * same visual language `CatalogProductCard` uses for a product photo, scaled
 * down to a 48px row.
 */
export function SearchDropdown({ tone }: { tone: ButtonTone }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const pathname = usePathname();

  useClickOutside(containerRef, () => setOpen(false));

  // Closes on navigation, same pattern `MobileMenu` uses against `pathname`.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") setOpen(false);
  }

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

      {open ? <SearchDropdownPanel listboxId={listboxId} onNavigate={() => setOpen(false)} /> : null}
    </div>
  );
}
