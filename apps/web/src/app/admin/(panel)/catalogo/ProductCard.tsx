"use client";

import type { AdminAccessory, AdminBike } from "@bw-bikes/shared";
import Image from "next/image";
import { memo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TableRowActions } from "@/components/ui/DataTable";
import { formatCurrencyCentsWithCurrency } from "@/lib/format";

export type ProductRow = AdminBike | AdminAccessory;

export interface ProductCardProps {
  row: ProductRow;
  editBasePath: string;
  onArchive: (row: ProductRow) => void;
  onRestore: (row: ProductRow) => void;
  onDelete: (row: ProductRow) => void;
}

/**
 * One card per product — extracted out of `CatalogView` (Sesión 2 de la
 * auditoría de rendimiento) so it can be `React.memo`-wrapped: with up to
 * `PAGE_SIZE` (20) cards each carrying a `next/image`, any unrelated state
 * change in `CatalogView` (the archive/delete dialog opening, its own
 * submitting flag) used to re-render every card on the page. It only pays
 * off as long as the caller keeps `onArchive`/`onRestore`/`onDelete`
 * referentially stable (`useCallback` in `CatalogView`) — `row` itself is
 * already stable, since it comes straight from the fetched page and is
 * only replaced wholesale on a real refetch.
 */
function ProductCardInner({ row, editBasePath, onArchive, onRestore, onDelete }: ProductCardProps) {
  const thumbnail = row.gallery[0];

  return (
    <div className="flex flex-col overflow-hidden rounded-card-lg border border-borde bg-surface">
      <div className="relative aspect-4/3 w-full bg-inset">
        {thumbnail ? (
          <Image
            src={thumbnail.url}
            alt={thumbnail.alt ?? row.name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-body text-caption text-grafito">Sin imagen</div>
        )}
        <div className="absolute top-sm right-sm">
          {row.isActive ? <Badge variant="accent">Activo</Badge> : <Badge variant="neutral">Archivado</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-sm p-md">
        <div className="min-w-0">
          <p className="truncate font-ui text-ui text-negro">{row.name}</p>
          <p className="truncate font-body text-caption text-grafito">
            {row.brand.name} · {row.category.name}
          </p>
        </div>
        {row.badges.length > 0 || row.isNewArrival || row.isCustomerFavorite ? (
          <div className="flex flex-wrap gap-xs">
            {row.badges.map((badge) => (
              <Badge key={badge.id} variant={badge.variant}>
                {badge.label}
              </Badge>
            ))}
            {/* Not one of `row.badges` — this is the home-rail curation flag
                (`isNewArrival`), shown here so the admin can see what it
                flagged without opening each product. */}
            {row.isNewArrival ? <Badge variant="accent">Novedad</Badge> : null}
            {/* Same idea as `isNewArrival` above: the "Favoritas de los
                ciclistas" rail's curation flag, not a badge the shopper sees. */}
            {row.isCustomerFavorite ? <Badge variant="accent">Favorita</Badge> : null}
          </div>
        ) : null}
        <p className="mt-auto font-body text-body-l text-negro">{formatCurrencyCentsWithCurrency(row.price)}</p>
      </div>
      <div className="border-t border-borde p-md">
        <TableRowActions>
          <ButtonLink href={`${editBasePath}/${row.id}`} variant="secondary" size="sm">
            Editar
          </ButtonLink>
          {row.isActive ? (
            <Button variant="ghost" size="sm" tone="danger" onClick={() => onArchive(row)}>
              Archivar
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onRestore(row)}>
                Restaurar
              </Button>
              <Button variant="ghost" size="sm" tone="danger-strong" onClick={() => onDelete(row)}>
                Eliminar
              </Button>
            </>
          )}
        </TableRowActions>
      </div>
    </div>
  );
}

export const ProductCard = memo(ProductCardInner);
