"use client";

import type { AdminAccessory, AdminBike, AdminBrand } from "@bw-bikes/shared";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TableRowActions } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/use-toast";
import { adminAccessoriesApi, adminBikesApi, type AdminProductListParams, type CategoryTreeNode } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { formatCurrencyCentsWithCurrency } from "@/lib/format";
import { CatalogFilters, DEFAULT_FILTERS, type CatalogFiltersValue } from "./CatalogFilters";

const PAGE_SIZE = 20;

export type CatalogKind = "bike" | "accessory";
type ProductRow = AdminBike | AdminAccessory;

interface ArchiveDialogState {
  id: string;
  name: string;
  action: "archive" | "restore";
}

interface DeleteDialogState {
  id: string;
  name: string;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export interface CatalogViewProps {
  kind: CatalogKind;
  categoryTree: CategoryTreeNode[];
  brands: AdminBrand[];
}

/**
 * The orchestrator (DASHBOARD_GUIDELINES.md §3's template, same shape M9's
 * `OrdersView` already uses): filters → table → pagination, for exactly one
 * catalog. Bikes and accessories used to share this screen behind a pair of
 * tabs; M10.1 split them into their own routes (`/admin/catalogo/bicicletas`,
 * `/admin/catalogo/accesorios`) reached from their own sidebar sections, so
 * there's nothing left to switch between in-page. No detail `SlideOver`
 * either — editing a product is big enough (ficha técnica, galería,
 * variantes) to warrant its own route instead of a 480px panel, unlike an
 * order's read-mostly detail.
 */
export function CatalogView({ kind, categoryTree, brands }: CatalogViewProps) {
  const { toast } = useToast();

  const [filters, setFilters] = useState<CatalogFiltersValue>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  const [archiveDialog, setArchiveDialog] = useState<ArchiveDialogState | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const isBikes = kind === "bike";
  const api = isBikes ? adminBikesApi : adminAccessoriesApi;
  const editBasePath = isBikes ? "/admin/catalogo/bicicletas" : "/admin/catalogo/accesorios";

  const effectiveParams: AdminProductListParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      sort: filters.sort,
      ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.brand.trim() ? { brand: filters.brand.trim() } : {}),
      ...(filters.isActive ? { isActive: filters.isActive === "true" } : {}),
    }),
    [page, filters],
  );

  // React's "adjust state when a prop changes" pattern — state set during
  // render, not inside an Effect (react-hooks/set-state-in-effect, same rule
  // M9's `OrdersView` works around the same way): a genuine filter/page
  // change resets to the loading state right here; a plain `refetch()` after
  // archiving leaves `requestKey` unchanged so the table doesn't flash a
  // full-page skeleton after every action.
  const requestKey = JSON.stringify({ kind, effectiveParams });
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  if (requestKey !== lastRequestKey) {
    setLastRequestKey(requestKey);
    setLoading(true);
    setLoadError(false);
  }

  useEffect(() => {
    let cancelled = false;
    api
      .list(effectiveParams)
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setMeta(result.meta ?? { total: result.data.length, page: 1, pages: 1, limit: PAGE_SIZE });
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, effectiveParams, refetchToken]);

  function refetch(): void {
    setRefetchToken((token) => token + 1);
  }

  function updateFilters(next: CatalogFiltersValue): void {
    setFilters(next);
    setPage(1);
  }

  async function handleArchiveConfirm(): Promise<void> {
    if (!archiveDialog) return;
    const { id, action } = archiveDialog;
    setArchiveSubmitting(true);
    try {
      if (action === "archive") await api.archive(id);
      else await api.restore(id);
      toast({ variant: "success", title: action === "archive" ? "Producto archivado" : "Producto restaurado" });
      setArchiveDialog(null);
      refetch();
    } catch (error) {
      toast({ variant: "error", title: "No se pudo actualizar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setArchiveSubmitting(false);
    }
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (!deleteDialog) return;
    setDeleteSubmitting(true);
    try {
      await api.remove(deleteDialog.id);
      toast({ variant: "success", title: isBikes ? "Bicicleta eliminada" : "Accesorio eliminado" });
      setDeleteDialog(null);
      refetch();
    } catch (error) {
      // The backend responds 409 with the blocking inventory count, or 400 if
      // it isn't archived yet — both are already the actionable message.
      toast({ variant: "error", title: "No se pudo eliminar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function renderRowActions(row: ProductRow): ReactNode {
    return (
      <TableRowActions>
        <ButtonLink href={`${editBasePath}/${row.id}`} variant="secondary" size="sm">
          Editar
        </ButtonLink>
        {row.isActive ? (
          <Button
            variant="ghost"
            size="sm"
            tone="danger"
            onClick={() => setArchiveDialog({ id: row.id, name: row.name, action: "archive" })}
          >
            Archivar
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => setArchiveDialog({ id: row.id, name: row.name, action: "restore" })}>
              Restaurar
            </Button>
            <Button variant="ghost" size="sm" tone="danger-strong" onClick={() => setDeleteDialog({ id: row.id, name: row.name })}>
              Eliminar
            </Button>
          </>
        )}
      </TableRowActions>
    );
  }

  // One card per product, at every width (Sesión E: bikes/accessories are
  // the only catalog lists with a photo worth leading with — the other five
  // stay tables). Photo 4:3 bled to the card's edges, then name/marca·
  // categoría/badges/price, then the same row actions as a footer.
  function renderCard(row: ProductRow): ReactNode {
    const thumbnail = row.gallery[0];
    return (
      <div key={row.id} className="flex flex-col overflow-hidden rounded-card-lg border border-borde bg-surface">
        <div className="relative aspect-4/3 w-full bg-inset">
          {thumbnail ? (
            <Image src={thumbnail.url} alt={thumbnail.alt ?? row.name} fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
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
          {row.badges.length > 0 ? (
            <div className="flex flex-wrap gap-xs">
              {row.badges.map((badge) => (
                <Badge key={badge.id} variant={badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="mt-auto font-body text-body-l text-negro">{formatCurrencyCentsWithCurrency(row.price)}</p>
        </div>
        <div className="border-t border-borde p-md">{renderRowActions(row)}</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-md px-md py-md sm:px-lg">
        <CatalogFilters value={filters} onChange={updateFilters} categoryTree={categoryTree} brands={brands} />
      </div>

      <ErrorBoundary>
        <div className="p-md sm:p-lg">
          {loading ? (
            <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : loadError ? (
            <EmptyState
              title="No se pudo cargar el catálogo"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={isBikes ? "No hay bicicletas con estos filtros" : "No hay accesorios con estos filtros"}
              description="Ajusta los filtros o crea el primer producto."
            />
          ) : (
            <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">{rows.map(renderCard)}</div>
          )}
        </div>
      </ErrorBoundary>

      <div className="px-md sm:px-lg">
        <Pagination meta={meta} onPageChange={setPage} />
      </div>

      <Modal
        open={archiveDialog !== null}
        onClose={() => setArchiveDialog(null)}
        title={archiveDialog?.action === "archive" ? "Archivar producto" : "Restaurar producto"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveDialog(null)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={archiveSubmitting} onClick={() => void handleArchiveConfirm()}>
              {archiveDialog?.action === "archive" ? "Sí, archivar" : "Sí, restaurar"}
            </Button>
          </>
        }
      >
        {archiveDialog ? (
          <p>
            {archiveDialog.action === "archive"
              ? `"${archiveDialog.name}" dejará de ser visible en la tienda. Puedes restaurarlo después.`
              : `"${archiveDialog.name}" volverá a ser visible en la tienda.`}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        title={isBikes ? "Eliminar bicicleta" : "Eliminar accesorio"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={deleteSubmitting} onClick={() => void handleDeleteConfirm()}>
              Sí, eliminar
            </Button>
          </>
        }
      >
        {deleteDialog ? <p>¿Eliminar &quot;{deleteDialog.name}&quot;? Esta acción no se puede deshacer.</p> : null}
      </Modal>
    </>
  );
}
