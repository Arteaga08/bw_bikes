"use client";

import type { WishlistEntry } from "@bw-bikes/shared";
import { Heart } from "@phosphor-icons/react";
import { useMemo } from "react";
import { CatalogProductCard } from "@/components/storefront/catalog/CatalogProductCard";
import { useWishlist } from "@/components/storefront/WishlistProvider";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PublicColorSwatch } from "@/lib/api/public-catalog";
import { toSummary } from "@/lib/api/public-catalog";

export interface GuardadosViewProps {
  initialWishlist: WishlistEntry[];
  colorSwatchIndex: Map<string, PublicColorSwatch>;
}

/**
 * `wishlist` re-derives from `initialWishlist` (the server's read) filtered
 * through `WishlistProvider`'s own `isSaved` on every render — quitting a
 * product from the heart embedded in `CatalogProductCard` below updates the
 * provider's shared state, and this list drops the tile in the same render
 * with no extra wiring of its own.
 */
export function GuardadosView({ initialWishlist, colorSwatchIndex }: GuardadosViewProps) {
  const { isSaved } = useWishlist();

  const wishlist = useMemo(
    () => initialWishlist.filter((entry) => entry.product && isSaved(entry.itemType, entry.itemId)),
    [initialWishlist, isSaved],
  );

  if (wishlist.length === 0) {
    return (
      <EmptyState
        icon={<Heart size={32} weight="regular" aria-hidden="true" />}
        title="Aún no guardas productos"
        description="Toca el corazón en cualquier producto del catálogo o de su ficha para guardarlo aquí."
        action={<ButtonLink href="/bicicletas">Ver catálogo</ButtonLink>}
      />
    );
  }

  return (
    <div>
      <h1 className="font-display text-h3 text-negro">Guardado para más tarde</h1>
      <div className="mt-md grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-3">
        {wishlist.map((entry) => (
          <div key={`${entry.itemType}:${entry.itemId}`} className="relative">
            <CatalogProductCard product={toSummary(entry.product!, entry.itemType)} colorSwatchIndex={colorSwatchIndex} />
            {!entry.isAvailable ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 rounded-b-card bg-negro/80 px-md py-xs text-center">
                <span className="font-ui text-caption text-blanco">Ya no disponible</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
