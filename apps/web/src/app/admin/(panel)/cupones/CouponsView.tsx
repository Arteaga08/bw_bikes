"use client";

import type { AdminCoupon } from "@bw-bikes/shared";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableSkeleton, TableRowActions, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/hooks/use-toast";
import { adminCouponsApi, type AdminCouponListParams } from "@/lib/api/admin-coupons";
import { ApiError } from "@/lib/api/error";
import { formatCurrencyCents } from "@/lib/format";

// Code-split like `CategoriesView` does: the form is a big component nobody
// needs until they click "Nuevo cupón".
const CouponFormModal = dynamic(() => import("./CouponFormModal").then((module) => module.CouponFormModal), {
  ssr: false,
});

const PAGE_SIZE = 20;

type StatusFilter = "todos" | "activos" | "inactivos";

interface FormDialogState {
  mode: "create" | "edit";
  coupon?: AdminCoupon;
}

interface DeleteDialogState {
  id: string;
  code: string;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** "10%" or "$500.00" — the campaign's headline number, however it's expressed. */
function formatDiscount(coupon: AdminCoupon): string {
  if (coupon.type === "percent_off") {
    const percent = (coupon.percentOffBps ?? 0) / 100;
    const ceiling = coupon.maxDiscountCents ? ` (máx. ${formatCurrencyCents(coupon.maxDiscountCents)})` : "";
    return `${percent}%${ceiling}`;
  }
  return formatCurrencyCents(coupon.amountOffCents ?? 0);
}

const SCOPE_LABELS: Readonly<Record<AdminCoupon["scope"]["kind"], string>> = {
  all: "Todo el catálogo",
  bikes: "Bicicletas",
  accessories: "Accesorios",
  categories: "Categorías",
};

function formatScope(coupon: AdminCoupon): string {
  if (coupon.scope.kind !== "categories") return SCOPE_LABELS[coupon.scope.kind];
  const count = coupon.scope.categoryIds?.length ?? 0;
  return `${count} categoría${count === 1 ? "" : "s"}`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

function formatDate(iso: string | undefined): string {
  return iso ? DATE_FORMATTER.format(new Date(iso)) : "—";
}

/**
 * The campaign's real state, which is **not** the same as `isActive`.
 *
 * A coupon can be flagged active and still be unusable — expired, not yet
 * started, or fully redeemed. Showing only the flag would leave an admin
 * wondering why customers report a "live" code being rejected, so the badge
 * answers the question they actually have: does this work right now?
 */
function statusBadge(coupon: AdminCoupon) {
  if (!coupon.isActive) return <Badge variant="neutral">Inactivo</Badge>;

  const now = Date.now();
  if (coupon.startsAt && now < new Date(coupon.startsAt).getTime()) {
    return <Badge variant="advertencia">Programado</Badge>;
  }
  if (coupon.expiresAt && now >= new Date(coupon.expiresAt).getTime()) {
    return <Badge variant="unavailable">Expirado</Badge>;
  }
  if (coupon.maxRedemptionsTotal !== undefined && coupon.redemptionCount >= coupon.maxRedemptionsTotal) {
    return <Badge variant="unavailable">Agotado</Badge>;
  }
  return <Badge variant="exito">Vigente</Badge>;
}

function formatRedemptions(coupon: AdminCoupon): string {
  return coupon.maxRedemptionsTotal === undefined
    ? String(coupon.redemptionCount)
    : `${coupon.redemptionCount} / ${coupon.maxRedemptionsTotal}`;
}

/**
 * Coupon campaigns (M19), on top of M18's backend.
 *
 * Same filters → table → pagination shape as `BrandsView`, with a table
 * rather than a card grid: a campaign is read by comparing its numbers
 * (discount, redemptions, expiry) across rows, which is what a table is for.
 *
 * Deletion is real but the API blocks it with a 409 once a campaign has been
 * redeemed — its message says to deactivate instead, and it's shown verbatim.
 */
export function CouponsView() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AdminCoupon[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  const [formDialog, setFormDialog] = useState<FormDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const effectiveParams: AdminCouponListParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      sort: "-createdAt",
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(status === "todos" ? {} : { isActive: status === "activos" }),
    }),
    [page, search, status],
  );

  // Same "adjust state during render" pattern as the other list views: a real
  // filter change flashes the skeleton, a post-action `refetch()` doesn't.
  const requestKey = JSON.stringify(effectiveParams);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  if (requestKey !== lastRequestKey) {
    setLastRequestKey(requestKey);
    setLoading(true);
    setLoadError(false);
  }

  useEffect(() => {
    let cancelled = false;
    adminCouponsApi
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

  function updateStatus(next: StatusFilter): void {
    setStatus(next);
    setPage(1);
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (!deleteDialog) return;
    setDeleteSubmitting(true);
    try {
      await adminCouponsApi.remove(deleteDialog.id);
      toast({ variant: "success", title: "Cupón eliminado" });
      setDeleteDialog(null);
      refetch();
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description: apiErrorMessage(error, "Intenta de nuevo."),
      });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const columns: DataTableColumn<AdminCoupon>[] = [
    {
      key: "code",
      header: "Código",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-ui text-ui text-negro">{row.code}</span>
          <span className="truncate font-body text-caption text-grafito">{row.name}</span>
        </div>
      ),
    },
    { key: "discount", header: "Descuento", render: (row) => formatDiscount(row) },
    { key: "scope", header: "Aplica a", render: (row) => formatScope(row) },
    { key: "redemptions", header: "Canjes", kind: "number", render: (row) => formatRedemptions(row) },
    { key: "expiresAt", header: "Expira", render: (row) => formatDate(row.expiresAt) },
    { key: "status", header: "Estado", kind: "status", render: (row) => statusBadge(row) },
    {
      key: "actions",
      header: "Acciones",
      kind: "actions",
      render: (row) => (
        <TableRowActions>
          <Button variant="secondary" size="sm" onClick={() => setFormDialog({ mode: "edit", coupon: row })}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            tone="danger-strong"
            onClick={() => setDeleteDialog({ id: row.id, code: row.code })}
          >
            Eliminar
          </Button>
        </TableRowActions>
      ),
    },
  ];

  function renderMobileRow(row: AdminCoupon) {
    return (
      <div className="flex flex-col gap-sm">
        <div className="flex items-start justify-between gap-sm">
          <div className="flex flex-col">
            <span className="font-ui text-ui text-negro">{row.code}</span>
            <span className="font-body text-caption text-grafito">{row.name}</span>
          </div>
          {statusBadge(row)}
        </div>
        <dl className="grid grid-cols-2 gap-xs font-body text-caption text-grafito">
          <div>
            <dt className="inline">Descuento: </dt>
            <dd className="inline text-negro">{formatDiscount(row)}</dd>
          </div>
          <div>
            <dt className="inline">Canjes: </dt>
            <dd className="inline text-negro">{formatRedemptions(row)}</dd>
          </div>
          <div>
            <dt className="inline">Aplica a: </dt>
            <dd className="inline text-negro">{formatScope(row)}</dd>
          </div>
          <div>
            <dt className="inline">Expira: </dt>
            <dd className="inline text-negro">{formatDate(row.expiresAt)}</dd>
          </div>
        </dl>
        <div className="flex items-center gap-sm">
          <Button variant="secondary" size="sm" onClick={() => setFormDialog({ mode: "edit", coupon: row })}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            tone="danger-strong"
            onClick={() => setDeleteDialog({ id: row.id, code: row.code })}
          >
            Eliminar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Cupones"
        subtitle="Campañas de descuento por código. El límite por cliente y el límite total son lo que hace seguro compartir un código."
        actions={
          <Button variant="primary" className="w-full sm:w-auto" onClick={() => setFormDialog({ mode: "create" })}>
            Nuevo cupón
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-md px-md py-md sm:px-lg">
        <Input
          label="Buscar"
          placeholder="Código o campaña"
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
          wrapperClassName="w-full sm:max-w-[18rem]"
        />
        <Select
          label="Estado"
          value={status}
          onChange={(event) => updateStatus(event.target.value as StatusFilter)}
          wrapperClassName="w-full sm:max-w-[12rem]"
        >
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </Select>
      </div>

      <ErrorBoundary>
        <div className="p-md sm:p-lg">
          {loading ? (
            <DataTableSkeleton columns={columns} mobile />
          ) : loadError ? (
            <EmptyState
              title="No se pudieron cargar los cupones"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No hay cupones con estos filtros"
              description="Ajusta la búsqueda o crea la primera campaña."
            />
          ) : (
            <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} mobileRow={renderMobileRow} />
          )}
        </div>
      </ErrorBoundary>

      <div className="px-md sm:px-lg">
        <Pagination meta={meta} onPageChange={setPage} />
      </div>

      {formDialog ? (
        <CouponFormModal
          key={formDialog.coupon?.id ?? "create"}
          initial={formDialog.coupon}
          onClose={() => setFormDialog(null)}
          onSaved={refetch}
        />
      ) : null}

      <Modal
        open={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        title="Eliminar cupón"
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
        {deleteDialog ? (
          <p>
            ¿Eliminar &quot;{deleteDialog.code}&quot;? Si ya fue canjeado no se podrá borrar — desactívalo en su lugar
            para conservar el historial.
          </p>
        ) : null}
      </Modal>
    </>
  );
}
