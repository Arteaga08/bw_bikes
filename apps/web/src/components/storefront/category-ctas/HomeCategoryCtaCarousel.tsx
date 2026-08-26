"use client";

import type { PublicHomeTile } from "@bw-bikes/shared";
import { ScrollRail } from "@/components/storefront/shared/ScrollRail";
import { HomeCategoryCtaTile } from "./HomeCategoryCtaTile";

const TILE_COPY: Record<PublicHomeTile["slot"], { label: string; href: string }> = {
  bikes: { label: "Comprar Bicicletas", href: "/bicicletas" },
  accessories: { label: "Comprar Accesorios", href: "/accesorios" },
};

export interface HomeCategoryCtaCarouselProps {
  tiles: PublicHomeTile[];
}

/**
 * Thin wrapper over `ScrollRail` — same split as `CategoryCarousel`/
 * `ProductCarousel`: the server component fetches and degrades, this client
 * component supplies the tiles and Spanish labels to the shared rail
 * mechanics (scroll, snap, arrows, progress).
 */
export function HomeCategoryCtaCarousel({ tiles }: HomeCategoryCtaCarouselProps) {
  return (
    <ScrollRail
      ariaLabel="Comprar por categoría"
      previousLabel="Categoría anterior"
      nextLabel="Siguiente categoría"
      gutter="tight"
    >
      {tiles.map((tile, index) => (
        <HomeCategoryCtaTile key={tile.slot} tile={tile} corner={index === 0 ? "left" : "right"} {...TILE_COPY[tile.slot]} />
      ))}
    </ScrollRail>
  );
}
