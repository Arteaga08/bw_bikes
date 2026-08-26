"use client";

import type { AdminHomeTile, HomeTileSlot } from "@bw-bikes/shared";
import { useState } from "react";
import { CategoryImageField } from "../../catalogo/categorias/CategoryImageField";
import { removeHomeTileImage, uploadHomeTileImage } from "@/lib/api/admin-content";

export interface HomeTilesViewProps {
  initialTiles: AdminHomeTile[];
}

const SLOT_LABELS: Record<HomeTileSlot, string> = {
  bikes: "Comprar Bicicletas",
  accessories: "Comprar Accesorios",
};

/**
 * The home's two CTA tile photos (M12, entrega 6) — just two
 * `CategoryImageField`s in `immediate` mode, one per fixed slot. No modal, no
 * form: there's nothing to create or reorder, only a photo to upload,
 * replace or remove per slot (see `content.ts`'s `HomeTileSlot` comment for
 * why title/CTA aren't editable here).
 */
export function HomeTilesView({ initialTiles }: HomeTilesViewProps) {
  const [tiles, setTiles] = useState(initialTiles);

  function patchTile(slot: HomeTileSlot, tile: AdminHomeTile): void {
    setTiles((current) => current.map((existing) => (existing.slot === slot ? tile : existing)));
  }

  return (
    <div className="mt-2xl flex flex-col gap-md">
      <h2 className="font-display text-h3 text-negro">Tarjetas &quot;Comprar Bicicletas / Accesorios&quot;</h2>
      <p className="font-body text-body text-grafito">
        La foto de cada tarjeta de la home — el título y el destino ya están fijos en el sitio.
      </p>

      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
        {tiles.map((tile) => (
          <div key={tile.slot} className="flex flex-col gap-xs">
            <span className="font-ui text-ui text-negro">{SLOT_LABELS[tile.slot]}</span>
            <CategoryImageField
              mode="immediate"
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
          </div>
        ))}
      </div>
    </div>
  );
}
