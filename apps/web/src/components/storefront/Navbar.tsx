"use client";

import type { PublicBrand, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { usePathname } from "next/navigation";
import { MobileMenu } from "@/components/storefront/MobileMenu";
import { NavbarActions } from "@/components/storefront/NavbarActions";
import { StorefrontNavLinks } from "@/components/storefront/StorefrontNavLinks";
import { Wordmark } from "@/components/storefront/Wordmark";
import { cn } from "@/lib/cn";
import { NAVBAR_OVERLAY_ROUTES, useNavbarOverlay } from "@/hooks/use-navbar-overlay";

/**
 * The storefront's top bar — redesigned against `orbea.com/es-mx` after the
 * first pass (plain white bar, four left-aligned links) read unstyled and
 * put the logo off-center. Now: three equal grid columns (links · logo ·
 * actions), the logo landing in the true center of the viewport rather than
 * between two unevenly-sized blocks a `flex justify-between` would produce.
 *
 * `"use client"`: every child needs the current tone (transparent-over-hero
 * vs. solid-on-scroll), and that tone comes from the browser
 * (`useNavbarOverlay`). The tone is computed once here and passed one level
 * down as a prop — no context, which would be more machinery than a tree
 * this shallow needs.
 *
 * `fixed`, not `sticky`: to sit *over* the hero rather than push it down,
 * the bar has to leave the document flow entirely. That means every route
 * needs 64px of compensation where the bar would have occupied space — this
 * component renders its own spacer for that, skipped only on routes that
 * declare their own overlay-worthy hero (`NAVBAR_OVERLAY_ROUTES`), because
 * those want their hero to start at y=0, under the transparent bar, not
 * pushed down by a spacer. Keeping the compensation here, next to the thing
 * that caused it, beats splitting it between the layout and every page.
 */
export interface NavbarProps {
  /** Fetched server-side by `(storefront)/layout.tsx` and threaded down to both `MobileMenu`'s and the desktop mega-menu's "Bicicletas" panel. */
  bikeCategories?: PublicCategoryTreeNode[];
  /** Same shape, accessory catalog — drives the "Accesorios" panel on both surfaces. */
  accessoryCategories?: PublicCategoryTreeNode[];
  /** Active brands — feeds "Comprar por marca" inside the "Bicicletas" panel on both surfaces. */
  brands?: PublicBrand[];
}

export function Navbar({ bikeCategories = [], accessoryCategories = [], brands = [] }: NavbarProps) {
  const pathname = usePathname();
  const overlay = useNavbarOverlay();
  const tone = overlay ? "inverse" : "neutral";
  const hasOwnHero = NAVBAR_OVERLAY_ROUTES.includes(pathname);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-30 h-16 border-b transition-colors duration-150",
          overlay ? "border-transparent bg-transparent" : "border-borde bg-surface",
        )}
      >
        {/* No `max-w-*`/`mx-auto` cap — edge-to-edge like the `orbea.com` reference. A centered
            max-width container was leaving ~150px of empty gutter on wide screens before the
            links even started, which read as "pushed to the middle," not left-aligned. */}
        <div className="grid h-16 grid-cols-3 items-center gap-md px-md lg:px-lg">
          <div className="flex items-center gap-lg justify-self-start">
            <MobileMenu tone={tone} bikeCategories={bikeCategories} accessoryCategories={accessoryCategories} brands={brands} />
            <nav aria-label="Navegación principal" className="hidden md:block">
              <StorefrontNavLinks tone={tone} bikeCategories={bikeCategories} accessoryCategories={accessoryCategories} brands={brands} />
            </nav>
          </div>

          <div className="justify-self-center">
            <Wordmark tone={tone} />
          </div>

          <div className="justify-self-end">
            <NavbarActions tone={tone} />
          </div>
        </div>
      </header>

      {hasOwnHero ? null : <div aria-hidden="true" className="h-16" />}
    </>
  );
}
