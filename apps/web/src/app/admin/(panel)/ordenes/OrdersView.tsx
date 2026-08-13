"use client";

import type { AdminOrder, OrderStatus, ShippingAddress } from "@bw-bikes/shared";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/hooks/use-toast";
import {
  bulkUpdateOrderStatus,
  confirmSupplierStock,
  getAdminOrder,
  listAdminOrders,
  rejectSupplierStock,
  recordOrderShipment,
  updateOrderShippingAddress,
  type RecordShipmentInput,
} from "@/lib/api/admin-orders";
import { ApiError } from "@/lib/api/error";
import { cn } from "@/lib/cn";
import { formatCurrencyCents } from "@/lib/format";
import { formatDateTime } from "@/lib/orders/format";
import { AuthorizationCountdown } from "./AuthorizationCountdown";
import { BulkStatusBar } from "./BulkStatusBar";
import { ConfirmSupplierDialog } from "./ConfirmSupplierDialog";
import { OrderFilters, type OrderFiltersValue } from "./OrderFilters";
import { OrderRowActions } from "./OrderRowActions";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { RejectSupplierDialog } from "./RejectSupplierDialog";

const OrderDetailSlideOver = dynamic(
  () => import("./OrderDetailSlideOver").then((mod) => mod.OrderDetailSlideOver),
  { ssr: false },
);

const PAGE_SIZE = 20;

type Tab = "queue" | "all";

interface ConfirmDialogState {
  id: string;
  orderNumber: string;
  totalCents: number;
}

interface RejectDialogState {
  id: string;
  orderNumber: string;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export interface OrdersViewProps {
  orderAuthAlertHours: number;
  orderAuthCancelHours: number;
}

/**
 * The orchestrator (DASHBOARD_GUIDELINES.md §3's template): tabs → filters →
 * dual mobile/desktop layout → pagination → lazy detail panel. Confirm/reject
 * dialogs live here, not inside the queue row or the detail panel, because
 * both need to trigger the exact same dialog instance for the same order.
 */
export function OrdersView({ orderAuthAlertHours, orderAuthCancelHours }: OrdersViewProps) {
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("queue");
  const [filters, setFilters] = useState<OrderFiltersValue>({ status: "", orderNumber: "", sort: "-createdAt" });
  const [page, setPage] = useState(1);

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [confirmDialogOrder, setConfirmDialogOrder] = useState<ConfirmDialogState | null>(null);
  const [rejectDialogOrder, setRejectDialogOrder] = useState<RejectDialogState | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<AdminOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [everOpenedDetail, setEverOpenedDetail] = useState(false);

  // Queue tab pins the params the operational queue is defined by; "all"
  // uses whatever the filter bar holds. createdAt ascending on the queue
  // approximates urgency (oldest authorization first) — the backend's sort
  // whitelist doesn't include `payment.authorizedAt` directly.
  const effectiveParams = useMemo(
    () =>
      tab === "queue"
        ? { page, limit: PAGE_SIZE, status: "awaiting_supplier_confirmation" as OrderStatus, sort: "createdAt" }
        : {
            page,
            limit: PAGE_SIZE,
            sort: filters.sort,
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.orderNumber.trim() ? { orderNumber: filters.orderNumber.trim().toUpperCase() } : {}),
          },
    [tab, page, filters],
  );

  // React's "adjust state when a prop changes" pattern (state set during
  // render, not inside an Effect — react-hooks/set-state-in-effect, the same
  // rule M8's MobileNavProvider works around): a genuine tab/filter/page
  // change is a direct consequence of this render, so resetting to the
  // loading state belongs here. A plain `refetch()` (after confirming or
  // rejecting an order) leaves `requestKey` unchanged — the table keeps
  // showing its current rows while the effect below quietly replaces them,
  // instead of flashing a full-page skeleton after every action.
  const requestKey = JSON.stringify(effectiveParams);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  if (requestKey !== lastRequestKey) {
    setLastRequestKey(requestKey);
    setLoading(true);
    setLoadError(false);
  }

  useEffect(() => {
    let cancelled = false;
    listAdminOrders(effectiveParams)
      .then((result) => {
        if (cancelled) return;
        setOrders(result.data.orders);
        setMeta(result.meta ?? { total: result.data.orders.length, page: 1, pages: 1, limit: PAGE_SIZE });
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

  function switchTab(next: Tab): void {
    setTab(next);
    setPage(1);
    setSelectedIds(new Set());
  }

  function updateFilters(next: OrderFiltersValue): void {
    setFilters(next);
    setPage(1);
  }

  async function loadDetail(id: string): Promise<void> {
    setDetailLoading(true);
    try {
      const order = await getAdminOrder(id);
      setDetailOrder(order);
    } catch (error) {
      toast({ variant: "error", title: "No se pudo cargar la orden", description: apiErrorMessage(error, "Intenta de nuevo.") });
      setDetailOrderId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function openDetail(id: string): void {
    if (!everOpenedDetail) setEverOpenedDetail(true);
    setDetailOrderId(id);
    setDetailOrder(null);
    void loadDetail(id);
  }

  function closeDetail(): void {
    setDetailOrderId(null);
    setDetailOrder(null);
  }

  async function refetchDetailIfOpen(id: string): Promise<void> {
    if (detailOrderId === id) await loadDetail(id);
  }

  async function handleConfirmSubmit(): Promise<void> {
    if (!confirmDialogOrder) return;
    const { id, orderNumber } = confirmDialogOrder;
    setConfirmSubmitting(true);
    try {
      await confirmSupplierStock(id);
      toast({ variant: "success", title: `${orderNumber} confirmada`, description: "Cargo capturado en Stripe." });
      setConfirmDialogOrder(null);
      refetch();
      await refetchDetailIfOpen(id);
    } catch (error) {
      toast({ variant: "error", title: "No se pudo confirmar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setConfirmSubmitting(false);
    }
  }

  async function handleRejectSubmit(reason: string): Promise<void> {
    if (!rejectDialogOrder) return;
    const { id, orderNumber } = rejectDialogOrder;
    setRejectSubmitting(true);
    try {
      await rejectSupplierStock(id, reason);
      toast({ variant: "success", title: `${orderNumber} rechazada`, description: "Autorización cancelada sin cobro." });
      setRejectDialogOrder(null);
      refetch();
      await refetchDetailIfOpen(id);
    } catch (error) {
      toast({ variant: "error", title: "No se pudo rechazar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setRejectSubmitting(false);
    }
  }

  async function markSingleStatus(id: string, status: "processing" | "delivered"): Promise<boolean> {
    try {
      const result = await bulkUpdateOrderStatus([id], status);
      const outcome = result.results[0];
      if (outcome?.outcome === "rejected") {
        toast({ variant: "error", title: "No se pudo actualizar", description: outcome.message ?? "Transición no permitida." });
        return false;
      }
      toast({ variant: "success", title: "Estatus actualizado" });
      refetch();
      await refetchDetailIfOpen(id);
      return true;
    } catch (error) {
      toast({ variant: "error", title: "No se pudo actualizar", description: apiErrorMessage(error, "Intenta de nuevo.") });
      return false;
    }
  }

  async function handleRecordShipment(id: string, input: RecordShipmentInput): Promise<boolean> {
    try {
      await recordOrderShipment(id, input);
      toast({ variant: "success", title: "Guía capturada" });
      refetch();
      await refetchDetailIfOpen(id);
      return true;
    } catch (error) {
      toast({ variant: "error", title: "No se pudo capturar la guía", description: apiErrorMessage(error, "Intenta de nuevo.") });
      return false;
    }
  }

  async function handleUpdateAddress(id: string, address: ShippingAddress): Promise<boolean> {
    try {
      await updateOrderShippingAddress(id, address);
      toast({ variant: "success", title: "Dirección actualizada" });
      refetch();
      await refetchDetailIfOpen(id);
      return true;
    } catch (error) {
      toast({ variant: "error", title: "No se pudo actualizar la dirección", description: apiErrorMessage(error, "Intenta de nuevo.") });
      return false;
    }
  }

  async function handleBulkStatus(status: "processing" | "delivered"): Promise<void> {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkSubmitting(true);
    try {
      const result = await bulkUpdateOrderStatus(ids, status);
      const { updated, unchanged, rejected } = result.summary;
      const description = `${updated} actualizada${updated === 1 ? "" : "s"}, ${unchanged} sin cambio, ${rejected} rechazada${rejected === 1 ? "" : "s"}.`;
      toast({ variant: rejected > 0 ? "warning" : "success", title: "Actualización masiva procesada", description });
      setSelectedIds(new Set());
      refetch();
    } catch (error) {
      toast({ variant: "error", title: "No se pudo procesar el lote", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setBulkSubmitting(false);
    }
  }

  function toggleSelected(id: string): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isQueue = tab === "queue";

  const columns: DataTableColumn<AdminOrder>[] = [
    ...(!isQueue
      ? [
          {
            key: "select",
            header: <span className="sr-only">Seleccionar</span>,
            className: "w-px",
            render: (order: AdminOrder) => (
              <input
                type="checkbox"
                checked={selectedIds.has(order.id)}
                onChange={() => toggleSelected(order.id)}
                aria-label={`Seleccionar ${order.orderNumber}`}
              />
            ),
          },
        ]
      : []),
    {
      key: "order",
      header: "Orden",
      kind: "text",
      render: (order) => (
        <div>
          <p className="font-ui text-ui text-negro">{order.orderNumber}</p>
          <p className="font-body text-caption text-grafito">{formatDateTime(order.createdAt)}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Cliente",
      kind: "text",
      render: (order) => (order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : "—"),
    },
    { key: "status", header: "Estatus", kind: "status", render: (order) => <OrderStatusBadge status={order.status} /> },
    {
      key: "authorization",
      header: "Autorización",
      render: (order) => (
        <AuthorizationCountdown
          authorizedAt={order.payment.authorizedAt}
          alertHours={orderAuthAlertHours}
          cancelHours={orderAuthCancelHours}
          adminAlertedAt={order.adminAlertedAt}
        />
      ),
    },
    { key: "total", header: "Total", kind: "number", render: (order) => formatCurrencyCents(order.totals.totalCents) },
    {
      key: "actions",
      header: "Acciones",
      kind: "actions",
      className: "w-px whitespace-nowrap",
      render: (order) => (
        <OrderRowActions
          showSupplierActions={isQueue}
          busy={confirmDialogOrder?.id === order.id || rejectDialogOrder?.id === order.id}
          onConfirm={() => setConfirmDialogOrder({ id: order.id, orderNumber: order.orderNumber, totalCents: order.totals.totalCents })}
          onReject={() => setRejectDialogOrder({ id: order.id, orderNumber: order.orderNumber })}
          onViewDetail={() => openDetail(order.id)}
        />
      ),
    },
  ];

  return (
    <>
      <div className="border-b border-borde px-md sm:px-lg">
        <nav className="flex gap-lg" aria-label="Vistas de órdenes">
          <button
            type="button"
            onClick={() => switchTab("queue")}
            aria-current={isQueue ? "true" : undefined}
            className={cn(
              "border-b-2 py-md font-ui text-ui transition-colors duration-150",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
              isQueue ? "border-negro text-negro" : "border-transparent text-grafito hover:text-negro",
            )}
          >
            Cola de proveedor{tab === "queue" ? ` (${meta.total})` : ""}
          </button>
          <button
            type="button"
            onClick={() => switchTab("all")}
            aria-current={!isQueue ? "true" : undefined}
            className={cn(
              "border-b-2 py-md font-ui text-ui transition-colors duration-150",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
              !isQueue ? "border-negro text-negro" : "border-transparent text-grafito hover:text-negro",
            )}
          >
            Todas
          </button>
        </nav>
      </div>

      {!isQueue ? <OrderFilters value={filters} onChange={updateFilters} /> : null}

      {!isQueue ? (
        <BulkStatusBar
          selectedCount={selectedIds.size}
          submitting={bulkSubmitting}
          onMarkProcessing={() => void handleBulkStatus("processing")}
          onMarkDelivered={() => void handleBulkStatus("delivered")}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      ) : null}

      <ErrorBoundary>
        <div className="p-md sm:p-lg">
          {loading ? (
            <DataTableSkeleton columns={columns} />
          ) : loadError ? (
            <EmptyState
              title="No se pudieron cargar las órdenes"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : orders.length === 0 ? (
            <EmptyState
              title={isQueue ? "No hay órdenes esperando confirmación" : "No hay órdenes con estos filtros"}
              description={isQueue ? "La cola de proveedor está al día." : "Ajusta los filtros para ver más resultados."}
            />
          ) : (
            <DataTable columns={columns} rows={orders} getRowKey={(order) => order.id} />
          )}
        </div>
      </ErrorBoundary>

      <div className="px-md sm:px-lg">
        <Pagination meta={meta} onPageChange={setPage} />
      </div>

      {everOpenedDetail ? (
        <OrderDetailSlideOver
          order={detailOrder}
          loading={detailLoading}
          onClose={closeDetail}
          alertHours={orderAuthAlertHours}
          cancelHours={orderAuthCancelHours}
          onRequestConfirm={() => {
            if (!detailOrder) return;
            setConfirmDialogOrder({ id: detailOrder.id, orderNumber: detailOrder.orderNumber, totalCents: detailOrder.totals.totalCents });
          }}
          onRequestReject={() => {
            if (!detailOrder) return;
            setRejectDialogOrder({ id: detailOrder.id, orderNumber: detailOrder.orderNumber });
          }}
          onMarkProcessing={() => (detailOrderId ? markSingleStatus(detailOrderId, "processing") : Promise.resolve(false))}
          onMarkDelivered={() => (detailOrderId ? markSingleStatus(detailOrderId, "delivered") : Promise.resolve(false))}
          onRecordShipment={(input) => (detailOrderId ? handleRecordShipment(detailOrderId, input) : Promise.resolve(false))}
          onUpdateShippingAddress={(address) =>
            detailOrderId ? handleUpdateAddress(detailOrderId, address) : Promise.resolve(false)
          }
        />
      ) : null}

      <ConfirmSupplierDialog
        open={confirmDialogOrder !== null}
        onClose={() => setConfirmDialogOrder(null)}
        onConfirm={handleConfirmSubmit}
        orderNumber={confirmDialogOrder?.orderNumber ?? ""}
        totalCents={confirmDialogOrder?.totalCents ?? 0}
        submitting={confirmSubmitting}
      />

      <RejectSupplierDialog
        open={rejectDialogOrder !== null}
        onClose={() => setRejectDialogOrder(null)}
        onConfirm={handleRejectSubmit}
        orderNumber={rejectDialogOrder?.orderNumber ?? ""}
        submitting={rejectSubmitting}
      />
    </>
  );
}
