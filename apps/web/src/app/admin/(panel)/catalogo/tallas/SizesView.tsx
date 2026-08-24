"use client";

import type { SizeTemplate } from "@bw-bikes/shared";
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
import {
  adminAccessorySizeTemplatesApi,
  adminBikeSizeTemplatesApi,
  type AdminSizeTemplateListParams,
} from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { SizeFormModal } from "./SizeFormModal";

export type SizesKind = "bike" | "accessory";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

interface FormDialogState {
  mode: "create" | "edit";
  template?: SizeTemplate;
}

interface DeleteDialogState {
  id: string;
  value: string;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatCount(total: number): string {
  return `${total} ${total === 1 ? "talla" : "tallas"}`;
}

function statusBadge(isActive: boolean) {
  return isActive ? <Badge variant="accent">Activa</Badge> : <Badge variant="neutral">Inactiva</Badge>;
}

function sourceBadge(source: SizeTemplate["source"]) {
  return source === "auto" ? <Badge variant="neutral">Automática</Badge> : <Badge variant="exito">Manual</Badge>;
}

export interface SizesViewProps {
  kind: SizesKind;
}

/**
 * One flat list, calcada de `SpecTemplatesView` (M10.3) — mismo shape de
 * recurso, un nivel más simple: una talla es solo su `value`, sin campos
 * propios. El mismo par de badges "Manual"/"Automática" distingue lo que un
 * admin escribió a propósito aquí de lo que `learnSizeTemplates` aprendió solo
 * al guardar un producto con una talla nueva.
 *
 * Dos catálogos independientes (bicis / accesorios), mismo split que
 * `CategoriesView` — "M" significa algo distinto en una bici que en un
 * accesorio, así que cada catálogo tiene su propia memoria.
 */
export function SizesView({ kind }: SizesViewProps) {
  const { toast } = useToast();
  const api = kind === "bike" ? adminBikeSizeTemplatesApi : adminAccessorySizeTemplatesApi;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<SizeTemplate[]>([]);
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

  const effectiveParams: AdminSizeTemplateListParams = useMemo(
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
      toast({ variant: "success", title: "Talla eliminada" });
      setDeleteDialog(null);
      refetch();
    } catch (error) {
      toast({ variant: "error", title: "No se pudo eliminar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function renderActions(row: SizeTemplate) {
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

  const columns: DataTableColumn<SizeTemplate>[] = [
    { key: "value", header: "Talla", kind: "text", render: (row) => row.value },
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

  const title = kind === "bike" ? "Tallas de bicicletas" : "Tallas de accesorios";
  const subtitle =
    kind === "bike"
      ? "Tallas reutilizables que el editor de bicicletas ofrece como chips al armar variantes, independientes de las de accesorios."
      : "Tallas reutilizables que el editor de accesorios ofrece como chips al armar variantes, independientes de las de bicicletas.";

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button variant="primary" className="w-full sm:w-auto" onClick={() => setFormDialog({ mode: "create" })}>
            Nueva talla
          </Button>
        }
      />

      <ListToolbar
        searchLabel="Buscar"
        searchPlaceholder="Talla"
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
              title="No se pudieron cargar las tallas"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No hay tallas con estos filtros"
              description="Ajusta la búsqueda, o guarda una talla nueva desde cualquier producto — se aprende sola."
            />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.id}
              mobileRow={(row) => (
                <div className="flex items-center gap-sm px-md py-xs">
                  <span className="min-w-0 truncate font-ui text-ui text-negro">{row.value}</span>
                  <Badge variant={row.isActive ? "accent" : "neutral"} className="ml-auto shrink-0">
                    {row.isActive ? "Activa" : "Inactiva"}
                  </Badge>
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
        <SizeFormModal
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
        title="Eliminar talla"
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
