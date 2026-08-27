"use client";

import { PhotoCtaTile } from "@/components/storefront/shared/PhotoCtaTile";
import { ScrollRail } from "@/components/storefront/shared/ScrollRail";
import type { BranchCtaTileData } from "./HomeBranchCtas";

export interface HomeBranchCtaCarouselProps {
  tiles: BranchCtaTileData[];
}

/**
 * Thin wrapper over `ScrollRail` — same split as `HomeCategoryCtaCarousel`:
 * the server component owns the (fixed) data, this client component supplies
 * it to the shared rail mechanics. Both tiles link off-site, so `external` is
 * always `true` here — unlike `HomeCategoryCtaTile`, which stays internal.
 */
export function HomeBranchCtaCarousel({ tiles }: HomeBranchCtaCarouselProps) {
  return (
    <ScrollRail ariaLabel="Sucursal y asesoría" previousLabel="Anterior" nextLabel="Siguiente" gutter="tight">
      {tiles.map((tile) => (
        <PhotoCtaTile key={tile.key} image={tile.image} label={tile.label} href={tile.href} external />
      ))}
    </ScrollRail>
  );
}
