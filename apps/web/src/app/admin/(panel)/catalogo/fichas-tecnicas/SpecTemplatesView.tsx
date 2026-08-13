"use client";

import type { SpecTemplate } from "@bw-bikes/shared";
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
import { adminSpecTemplatesApi, type AdminSpecTemplateListParams } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { SpecTemplateFormModal } from "./SpecTemplateFormModal";

const PAGE_SIZE = 20;

interface FormDialogState {
  mode: "create" | "edit";
  template?: SpecTemplate;
}

interface DeleteDialogState {
  id: string;
  title: string;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * One flat list, same shape as `BadgesView`/`BrandsView`. The one thing
 * specific to this resource: a "Automática"/"Manual" badge per row, so the
 * admin can tell a template it typed on purpose apart from one the system
 * learned from a product save (`source` — see `spec-template.model.ts`) and
 * decide whether to keep, edit or delete it.
 */
export function SpecTemplatesView() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<SpecTemplate[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  const [formDialog, setFormDialog] = useState<FormDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const effectiveParams: AdminSpecTemplateListParams = useMemo(
    () => ({ page, limit: PAGE_SIZE, sort: "order", ...(search.trim() ? { search: search.trim() } : {}) }),
    [page, search],
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
    adminSpecTemplatesApi
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
      await adminSpecTemplatesApi.remove(deleteDialog.id);
      toast({ variant: "success", title: "Plantilla eliminada" });
      setDeleteDialog(null);
      refetch();
    } catch (error) {
      toast({ variant: "error", title: "No se pudo eliminar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const columns: DataTableColumn<SpecTemplate>[] = [
    { key: "title", header: "Título", kind: "text", render: (row) => row.title },
    { key: "fields", header: "Campos", kind: "number", render: (row) => String(row.fields.length) },
    {
      key: "source",
      header: "Origen",
      kind: "status",
      render: (row) =>
        row.source === "auto" ? <Badge variant="neutral">Automática</Badge> : <Badge variant="exito">Manual</Badge>,
    },
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
          <Button variant="secondary" size="sm" onClick={() => setFormDialog({ mode: "edit", template: row })}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" tone="danger-strong" onClick={() => setDeleteDialog({ id: row.id, title: row.title })}>
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
          placeholder="Título"
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
          wrapperClassName="w-full sm:max-w-[18rem]"
        />
        <Button variant="primary" onClick={() => setFormDialog({ mode: "create" })}>
          Nueva plantilla
        </Button>
      </div>

      <ErrorBoundary>
        <div className="p-md sm:p-lg">
          {loading ? (
            <DataTableSkeleton columns={columns} />
          ) : loadError ? (
            <EmptyState
              title="No se pudieron cargar las plantillas"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No hay plantillas con estos filtros"
              description="Ajusta la búsqueda, o guarda un grupo nuevo desde cualquier producto — se aprende solo."
            />
          ) : (
            <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />
          )}
        </div>
      </ErrorBoundary>

      <div className="px-md sm:px-lg">
        <Pagination meta={meta} onPageChange={setPage} />
      </div>

      {formDialog ? (
        <SpecTemplateFormModal
          key={formDialog.template?.id ?? "create"}
          initial={formDialog.template}
          onClose={() => setFormDialog(null)}
          onSaved={() => refetch()}
        />
      ) : null}

      <Modal
        open={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        title="Eliminar plantilla"
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
        {deleteDialog ? <p>¿Eliminar &quot;{deleteDialog.title}&quot;? Esta acción no se puede deshacer.</p> : null}
      </Modal>
    </>
  );
}
