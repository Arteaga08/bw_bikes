"use client";

import type { ColorTemplate } from "@bw-bikes/shared";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ColorSwatch } from "@/components/ui/ColorSwatch";
import { DataTable, DataTableSkeleton, TableRowActions, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToast } from "@/hooks/use-toast";
import { adminColorTemplatesApi, type AdminColorTemplateListParams } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { ColorFormModal } from "./ColorFormModal";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

interface FormDialogState {
  mode: "create" | "edit";
  template?: ColorTemplate;
}

interface DeleteDialogState {
  id: string;
  value: string;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatCount(total: number): string {
  return `${total} ${total === 1 ? "color" : "colores"}`;
}

function statusBadge(isActive: boolean) {
  return isActive ? <Badge variant="accent">Activa</Badge> : <Badge variant="neutral">Inactiva</Badge>;
}

function sourceBadge(source: ColorTemplate["source"]) {
  return source === "auto" ? <Badge variant="neutral">Automática</Badge> : <Badge variant="exito">Manual</Badge>;
}

/**
 * One flat list, mirror de `SizesView` — a diferencia de tallas, un solo
 * catálogo compartido entre bicicletas y accesorios (un color como "Negro
 * mate" significa lo mismo en ambos), así que no hay split `kind` ni rutas
 * `/bicicletas`/`/accesorios`.
 */
export function ColoresView() {
  const { toast } = useToast();
  const api = adminColorTemplatesApi;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<ColorTemplate[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  const [formDialog, setFormDialog] = useState<FormDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const skipReset = useRef(true);
  useEffect(() => {
    if (skipReset.current) {
      skipReset.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch]);

  const effectiveParams: AdminColorTemplateListParams = useMemo(
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

  async function handleDeleteConfirm(): Promise<void> {
    if (!deleteDialog) return;
    setDeleteSubmitting(true);
    try {
      await api.remove(deleteDialog.id);
      toast({ variant: "success", title: "Color eliminado" });
      setDeleteDialog(null);
      refetch();
    } catch (error) {
      toast({ variant: "error", title: "No se pudo eliminar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function renderActions(row: ColorTemplate) {
    return (
      <TableRowActions>
        <Button variant="secondary" size="sm" onClick={() => setFormDialog({ mode: "edit", template: row })}>
          Editar
        </Button>
        <Button variant="ghost" size="sm" tone="danger-strong" onClick={() => setDeleteDialog({ id: row.id, value: row.value })}>
          Eliminar
        </Button>
      </TableRowActions>
    );
  }

  const columns: DataTableColumn<ColorTemplate>[] = [
    {
      key: "value",
      header: "Color",
      kind: "text",
      render: (row) => (
        <span className="inline-flex items-center gap-xs">
          <ColorSwatch hex={row.hex} secondaryHex={row.secondaryHex} className="h-4 w-4" />
          {row.value}
        </span>
      ),
    },
    { key: "source", header: "Origen", kind: "status", render: (row) => sourceBadge(row.source) },
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
        title="Colores"
        subtitle="Colores reutilizables que el editor de bicicletas y accesorios ofrece al armar variantes — un solo catálogo compartido entre ambos."
        actions={
          <Button variant="primary" className="w-full sm:w-auto" onClick={() => setFormDialog({ mode: "create" })}>
            Nuevo color
          </Button>
        }
      />

      <ListToolbar
        searchLabel="Buscar"
        searchPlaceholder="Color"
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
              title="No se pudieron cargar los colores"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No hay colores con estos filtros"
              description="Ajusta la búsqueda, o guarda un color nuevo desde cualquier producto — se aprende solo."
            />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.id}
              mobileRow={(row) => (
                <div className="flex items-center gap-sm px-md py-xs">
                  <ColorSwatch hex={row.hex} secondaryHex={row.secondaryHex} className="h-4 w-4" />
                  <span className="min-w-0 truncate font-ui text-ui text-negro">{row.value}</span>
                  <span className="ml-auto shrink-0 font-body text-caption text-grafito">
                    {row.isActive ? "Activa" : "Inactiva"}
                  </span>
                  <div className="flex shrink-0 items-center gap-xs">
                    <Button
                      variant="bare"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => setFormDialog({ mode: "edit", template: row })}
                    >
                      <PencilSimple size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="bare"
                      size="icon"
                      tone="danger-strong"
                      aria-label="Eliminar"
                      onClick={() => setDeleteDialog({ id: row.id, value: row.value })}
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
        <ColorFormModal
          key={formDialog.template?.id ?? "create"}
          api={api}
          initial={formDialog.template}
          onClose={() => setFormDialog(null)}
          onSaved={() => refetch()}
        />
      ) : null}

      <Modal
        open={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        title="Eliminar color"
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
        {deleteDialog ? <p>¿Eliminar &quot;{deleteDialog.value}&quot;? Esta acción no se puede deshacer.</p> : null}
      </Modal>
    </>
  );
}
