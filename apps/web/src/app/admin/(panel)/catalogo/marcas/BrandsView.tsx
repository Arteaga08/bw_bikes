"use client";

import type { AdminBrand } from "@bw-bikes/shared";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableSkeleton, TableRowActions, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/hooks/use-toast";
import { adminBrandsApi, type AdminBrandListParams } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { BrandFormModal } from "./BrandFormModal";

const PAGE_SIZE = 20;

interface FormDialogState {
  mode: "create" | "edit";
  brand?: AdminBrand;
}

interface DeleteDialogState {
  id: string;
  name: string;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * One flat list, unlike the two category trees — a brand isn't scoped to
 * bikes or accessories, it sells both (`brand.model.ts`). Same
 * filters → table → pagination shape as `CatalogView`, minus the
 * archive/restore step: a brand has no logical-delete requirement (nothing
 * downstream snapshots it — the order line freezes the brand's *name*, not a
 * reference), so `isActive` is a plain field on the edit form, and deletion
 * is real, blocked with a 409 while any product still points at it.
 */
export function BrandsView() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AdminBrand[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  const [formDialog, setFormDialog] = useState<FormDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const effectiveParams: AdminBrandListParams = useMemo(
    () => ({ page, limit: PAGE_SIZE, sort: "name", ...(search.trim() ? { search: search.trim() } : {}) }),
    [page, search],
  );

  // Same "adjust state during render" pattern as `CatalogView` — a genuine
  // filter/page change resets to the loading state right here; a plain
  // `refetch()` after an action leaves `requestKey` unchanged so the table
  // doesn't flash a full skeleton after every action.
  const requestKey = JSON.stringify(effectiveParams);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  if (requestKey !== lastRequestKey) {
    setLastRequestKey(requestKey);
    setLoading(true);
    setLoadError(false);
  }

  useEffect(() => {
    let cancelled = false;
    adminBrandsApi
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
  }, [effectiveParams, refetchToken]);

  function refetch(): void {
    setRefetchToken((token) => token + 1);
  }

  function updateSearch(next: string): void {
    setSearch(next);
    setPage(1);
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (!deleteDialog) return;
    setDeleteSubmitting(true);
    try {
      await adminBrandsApi.remove(deleteDialog.id);
      toast({ variant: "success", title: "Marca eliminada" });
      setDeleteDialog(null);
      refetch();
    } catch (error) {
      // The backend responds 409 with the blocking product count — shown
      // verbatim, it's already the actionable answer.
      toast({ variant: "error", title: "No se pudo eliminar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const columns: DataTableColumn<AdminBrand>[] = [
    {
      key: "logo",
      header: <span className="sr-only">Logo</span>,
      className: "w-px",
      render: (row) =>
        row.logo ? (
          <Image src={row.logo.url} alt="" width={32} height={32} className="h-8 w-8 rounded-control object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-control bg-base" aria-hidden />
        ),
    },
    { key: "name", header: "Nombre", kind: "text", render: (row) => row.name },
    { key: "slug", header: "Slug", kind: "text", render: (row) => row.slug },
    {
      key: "status",
      header: "Estatus",
      kind: "status",
      render: (row) => (row.isActive ? <Badge variant="exito">Activa</Badge> : <Badge variant="neutral">Inactiva</Badge>),
    },
    {
      key: "actions",
      header: "Acciones",
      kind: "actions",
      className: "w-px whitespace-nowrap",
      render: (row) => (
        <TableRowActions>
          <Button variant="secondary" size="sm" onClick={() => setFormDialog({ mode: "edit", brand: row })}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" tone="danger-strong" onClick={() => setDeleteDialog({ id: row.id, name: row.name })}>
            Eliminar
          </Button>
        </TableRowActions>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-md px-md py-md sm:px-lg">
        <Input
          label="Buscar"
          placeholder="Nombre o slug"
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
          wrapperClassName="w-full sm:max-w-[18rem]"
        />
        <Button variant="primary" onClick={() => setFormDialog({ mode: "create" })}>
          Nueva marca
        </Button>
      </div>

      <ErrorBoundary>
        <div className="p-md sm:p-lg">
          {loading ? (
            <DataTableSkeleton columns={columns} />
          ) : loadError ? (
            <EmptyState
              title="No se pudieron cargar las marcas"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState title="No hay marcas con estos filtros" description="Ajusta la búsqueda o crea la primera marca." />
          ) : (
            <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />
          )}
        </div>
      </ErrorBoundary>

      <div className="px-md sm:px-lg">
        <Pagination meta={meta} onPageChange={setPage} />
      </div>

      {formDialog ? (
        <BrandFormModal
          key={formDialog.brand?.id ?? "create"}
          initial={formDialog.brand}
          onClose={() => setFormDialog(null)}
          onSaved={() => {
            refetch();
          }}
        />
      ) : null}

      <Modal
        open={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        title="Eliminar marca"
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
