"use client";

import type { AdminBadge } from "@bw-bikes/shared";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableSkeleton, TableRowActions, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToast } from "@/hooks/use-toast";
import { adminBadgesApi, type AdminBadgeListParams } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { BadgeFormModal } from "./BadgeFormModal";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

interface FormDialogState {
  mode: "create" | "edit";
  badge?: AdminBadge;
}

interface DeleteDialogState {
  id: string;
  label: string;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatCount(total: number): string {
  return `${total} ${total === 1 ? "badge" : "badges"}`;
}

function statusBadge(isActive: boolean) {
  return isActive ? <Badge variant="accent">Activo</Badge> : <Badge variant="neutral">Inactivo</Badge>;
}

/** One flat list, same shape as `BrandsView` minus the logo column — a badge is just a label and a design-system variant. */
export function BadgesView() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AdminBadge[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  const [formDialog, setFormDialog] = useState<FormDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Resets the page only once the debounced term actually changes, not on
  // every keystroke — `skipReset` swallows the run debouncing itself
  // triggers on mount, where there's nothing to reset yet.
  const skipReset = useRef(true);
  useEffect(() => {
    if (skipReset.current) {
      skipReset.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch]);

  const effectiveParams: AdminBadgeListParams = useMemo(
    () => ({ page, limit: PAGE_SIZE, sort: "order", ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}) }),
    [page, debouncedSearch],
  );

  const requestKey = JSON.stringify(effectiveParams);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  if (requestKey !== lastRequestKey) {
    setLastRequestKey(requestKey);
    setLoading(true);
    setLoadError(false);
  }

  useEffect(() => {
    let cancelled = false;
    adminBadgesApi
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

  async function handleDeleteConfirm(): Promise<void> {
    if (!deleteDialog) return;
    setDeleteSubmitting(true);
    try {
      await adminBadgesApi.remove(deleteDialog.id);
      toast({ variant: "success", title: "Badge eliminado" });
      setDeleteDialog(null);
      refetch();
    } catch (error) {
      toast({ variant: "error", title: "No se pudo eliminar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function renderActions(row: AdminBadge) {
    return (
      <TableRowActions>
        <Button variant="secondary" size="sm" onClick={() => setFormDialog({ mode: "edit", badge: row })}>
          Editar
        </Button>
        <Button variant="ghost" size="sm" tone="danger-strong" onClick={() => setDeleteDialog({ id: row.id, label: row.label })}>
          Eliminar
        </Button>
      </TableRowActions>
    );
  }

  const columns: DataTableColumn<AdminBadge>[] = [
    {
      key: "preview",
      header: "Vista previa",
      kind: "status",
      render: (row) => <Badge variant={row.variant}>{row.label}</Badge>,
    },
    { key: "label", header: "Etiqueta", kind: "text", render: (row) => row.label },
    { key: "status", header: "Estatus", kind: "status", render: (row) => statusBadge(row.isActive) },
    {
      key: "actions",
      header: "Acciones",
      kind: "actions",
      className: "w-px whitespace-nowrap",
      render: renderActions,
    },
  ];

  return (
    <>
      <PageHeader
        title="Badges"
        subtitle="Etiquetas de merchandising — Novedad, Bestseller — que un producto puede lucir en la ficha pública. Hasta 3 por producto."
        actions={
          <Button variant="primary" className="w-full sm:w-auto" onClick={() => setFormDialog({ mode: "create" })}>
            Nuevo badge
          </Button>
        }
      />

      <ListToolbar
        searchLabel="Buscar"
        searchPlaceholder="Etiqueta"
        value={search}
        onChange={setSearch}
        count={!loading && !loadError ? formatCount(meta.total) : undefined}
      />

      <ErrorBoundary>
        <div className="p-md sm:p-lg">
          {loading ? (
            <DataTableSkeleton columns={columns} mobile />
          ) : loadError ? (
            <EmptyState
              title="No se pudieron cargar los badges"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState title="No hay badges con estos filtros" description="Ajusta la búsqueda o crea el primer badge." />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.id}
              mobileRow={(row) => (
                <div className="flex items-center gap-sm px-md py-xs">
                  <span className="min-w-0 truncate font-ui text-ui text-negro">{row.label}</span>
                  <Badge variant={row.isActive ? "accent" : "neutral"} className="ml-auto shrink-0">
                    {row.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                  <div className="flex shrink-0 items-center gap-xs">
                    <Button
                      variant="bare"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => setFormDialog({ mode: "edit", badge: row })}
                    >
                      <PencilSimple size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="bare"
                      size="icon"
                      tone="danger-strong"
                      aria-label="Eliminar"
                      onClick={() => setDeleteDialog({ id: row.id, label: row.label })}
                    >
                      <Trash size={16} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      </ErrorBoundary>

      <div className="px-md sm:px-lg">
        <Pagination meta={meta} onPageChange={setPage} />
      </div>

      {formDialog ? (
        <BadgeFormModal
          key={formDialog.badge?.id ?? "create"}
          initial={formDialog.badge}
          onClose={() => setFormDialog(null)}
          onSaved={() => refetch()}
        />
      ) : null}

      <Modal
        open={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        title="Eliminar badge"
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
        {deleteDialog ? <p>¿Eliminar &quot;{deleteDialog.label}&quot;? Esta acción no se puede deshacer.</p> : null}
      </Modal>
    </>
  );
}
