"use client";

import type { AdminHomeTile, HomeTileSlot } from "@bw-bikes/shared";
import { useState } from "react";
import { ImageField } from "@/components/ui/ImageField";
import { removeHomeTileImage, uploadHomeTileImage } from "@/lib/api/admin-content";
import { EditorSection } from "../../catalogo/EditorSection";

export interface HomeTilesViewProps {
  initialTiles: AdminHomeTile[];
}

/** Mirrors `TILE_COPY` in `HomeCategoryCtaCarousel.tsx` — the label and destination the storefront actually renders for each slot. */
const SLOT_COPY: Record<HomeTileSlot, { label: string; href: string }> = {
  bikes: { label: "Comprar Bicicletas", href: "/bicicletas" },
  accessories: { label: "Comprar Accesorios", href: "/accesorios" },
};

/**
 * The home's two CTA tile photos (M12, entrega 6) — just two `ImageField`s
 * in `immediate` mode, one per fixed slot. No modal, no form: there's
 * nothing to create or reorder, only a photo to upload, replace or remove
 * per slot (see `content.ts`'s `HomeTileSlot` comment for why title/CTA
 * aren't editable here).
 */
export function HomeTilesView({ initialTiles }: HomeTilesViewProps) {
  const [tiles, setTiles] = useState(initialTiles);

  function patchTile(slot: HomeTileSlot, tile: AdminHomeTile): void {
    setTiles((current) => current.map((existing) => (existing.slot === slot ? tile : existing)));
  }

  return (
    <EditorSection
      id="home-tiles"
      title="Tarjetas de compra"
      description="La foto de cada una de las dos tarjetas grandes de la home. El título y el destino ya están fijos en el sitio, y los cambios de foto se guardan al instante."
    >
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
        {tiles.map((tile) => {
          const { label, href } = SLOT_COPY[tile.slot];
          return (
            <div key={tile.slot} className="flex flex-col gap-xs">
              <ImageField
                mode="immediate"
                aspect="3/2"
                label={label}
                image={tile.image}
                onUpload={async (file) => {
                  const updated = await uploadHomeTileImage(tile.slot, file);
                  patchTile(tile.slot, updated);
                }}
                onRemove={async () => {
                  const updated = await removeHomeTileImage(tile.slot);
                  patchTile(tile.slot, updated);
                }}
              />
              <p className="font-body text-caption text-grafito">Lleva a {href}</p>
            </div>
          );
        })}
      </div>
    </EditorSection>
  );
}
