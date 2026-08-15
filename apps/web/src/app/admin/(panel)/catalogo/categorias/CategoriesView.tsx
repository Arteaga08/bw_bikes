"use client";

import type { AdminCategory } from "@bw-bikes/shared";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, TableRowActions, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/cn";
import { adminAccessoryCategoriesApi, adminBikeCategoriesApi, type CategoryTreeNode } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { CategoryFormModal } from "./CategoryFormModal";

export type CategoriesKind = "bike" | "accessory";

/** One row per category, root or child, flattened from the tree so it can render inside a plain `DataTable` — `depth` drives indentation, `isRoot` gates which row-only actions ("Agregar subcategoría") apply. */
interface CategoryRow {
  category: AdminCategory;
  depth: 0 | 1;
  isRoot: boolean;
}

function flattenTree(tree: CategoryTreeNode[]): CategoryRow[] {
  return tree.flatMap((root) => [
    { category: root, depth: 0 as const, isRoot: true },
    ...root.children.map((child) => ({ category: child, depth: 1 as const, isRoot: false })),
  ]);
}

interface FormDialogState {
  mode: "create" | "edit";
  category?: AdminCategory;
  /** Root id to preselect as "Categoría padre" — set when opening from a root row's "Agregar subcategoría". */
  defaultParent?: string;
}

interface DeleteDialogState {
  id: string;
  name: string;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export interface CategoriesViewProps {
  kind: CategoriesKind;
  initialTree: CategoryTreeNode[];
}

/**
 * One tree — bikes and accessories used to share this screen behind a pair of
 * tabs; M10.1 gave each its own route (`/admin/catalogo/categorias/bicicletas`,
 * `/admin/catalogo/categorias/accesorios`), next to its own product catalog in
 * the sidebar rather than tucked behind a link inside the product screen. Not
 * paginated: `GET .../tree` returns the whole tree in one round trip by
 * design (bounded by the two-level rule), so there's nothing to page through.
 */
export function CategoriesView({ kind, initialTree }: CategoriesViewProps) {
  const { toast } = useToast();

  const [tree, setTree] = useState(initialTree);
  const [formDialog, setFormDialog] = useState<FormDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const api = kind === "bike" ? adminBikeCategoriesApi : adminAccessoryCategoriesApi;

  // `CategoryTreeNode` carries every `AdminCategory` field plus `children` —
  // structurally assignable as-is, no mapping needed to drop the extra field.
  const rootOptions: AdminCategory[] = tree;

  async function refreshTree(): Promise<void> {
    try {
      setTree(await api.tree());
    } catch (error) {
      toast({ variant: "error", title: "No se pudo actualizar el árbol", description: apiErrorMessage(error, "Intenta de nuevo.") });
    }
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (!deleteDialog) return;
    setDeleteSubmitting(true);
    try {
      await api.remove(deleteDialog.id);
      toast({ variant: "success", title: "Categoría eliminada" });
      setDeleteDialog(null);
      await refreshTree();
    } catch (error) {
      // The backend responds 409 with the blocking counts when the category
      // isn't empty — shown verbatim, it's already the actionable answer.
      toast({ variant: "error", title: "No se pudo eliminar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const rows = flattenTree(tree);
  const title = kind === "bike" ? "Categorías de bicicletas" : "Categorías de accesorios";
  const subtitle =
    kind === "bike"
      ? "Jerarquía de hasta dos niveles, independiente del árbol de accesorios."
      : "Jerarquía de hasta dos niveles, independiente del árbol de bicicletas.";

  const columns: DataTableColumn<CategoryRow>[] = [
    {
      key: "name",
      header: "Categoría",
      kind: "text",
      render: ({ category, depth }) => (
        <div className={cn("flex items-center gap-sm", depth === 1 && "border-l border-borde pl-md")}>
          {category.image ? (
            <Image
              src={category.image.url}
              alt={category.image.alt ?? ""}
              width={32}
              height={32}
              className="h-8 w-8 rounded-control object-cover"
            />
          ) : (
            <div className="h-8 w-8 rounded-control bg-inset" aria-hidden />
          )}
          <span className={depth === 0 ? "font-ui text-ui text-negro" : "font-body text-body text-negro"}>{category.name}</span>
        </div>
      ),
    },
    { key: "slug", header: "Slug", kind: "text", render: ({ category }) => category.slug },
    { key: "order", header: "Orden", kind: "number", render: ({ category }) => String(category.order) },
    {
      key: "status",
      header: "Estatus",
      kind: "status",
      render: ({ category }) => (category.isActive ? <Badge variant="accent">Activa</Badge> : <Badge variant="neutral">Inactiva</Badge>),
    },
    {
      key: "actions",
      header: "Acciones",
      kind: "actions",
      className: "w-px whitespace-nowrap",
      render: ({ category, isRoot }) => (
        <TableRowActions>
          {isRoot ? (
            <Button variant="ghost" size="sm" onClick={() => setFormDialog({ mode: "create", defaultParent: category.id })}>
              Agregar subcategoría
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setFormDialog({ mode: "edit", category })}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" tone="danger-strong" onClick={() => setDeleteDialog({ id: category.id, name: category.name })}>
            Eliminar
          </Button>
        </TableRowActions>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button variant="primary" className="w-full sm:w-auto" onClick={() => setFormDialog({ mode: "create" })}>
            Agregar categoría
          </Button>
        }
      />

      <div className="p-md sm:p-lg">
        {rows.length === 0 ? (
          <EmptyState
            title="Sin categorías todavía."
            description="Crea la primera categoría para empezar a organizar el catálogo."
          />
        ) : (
          <DataTable columns={columns} rows={rows} getRowKey={(row) => row.category.id} minWidthClassName="min-w-[38rem]" />
        )}
      </div>

      {formDialog ? (
        <CategoryFormModal
          key={formDialog.category?.id ?? `create-${formDialog.defaultParent ?? "root"}`}
          onClose={() => setFormDialog(null)}
          onCreate={api.create}
          onUpdate={api.update}
          onUploadImage={api.uploadImage}
          onRemoveImage={api.removeImage}
          onChanged={() => void refreshTree()}
          rootOptions={rootOptions}
          initial={formDialog.category}
          defaultParent={formDialog.defaultParent}
        />
      ) : null}

      <Modal
        open={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        title="Eliminar categoría"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={deleteSubmitting} onClick={() => void handleDeleteConfirm()}>
              Eliminar
            </Button>
          </>
        }
      >
        {deleteDialog ? <p>¿Eliminar &quot;{deleteDialog.name}&quot;? Esta acción no se puede deshacer.</p> : null}
      </Modal>
    </>
  );
}
