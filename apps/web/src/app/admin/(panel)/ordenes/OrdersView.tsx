"use client";

import type { AdminOrder, AdminOrdersSummary, OrderActivityEntry, OrderPriority, OrderStatus, ShippingAddress } from "@bw-bikes/shared";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Pagination } from "@/components/ui/Pagination";
import { Tab, TabList } from "@/components/ui/Tabs";
import { useToast } from "@/hooks/use-toast";
import {
  addOrderInternalNote,
  bulkUpdateOrderStatus,
  confirmSupplierStock,
  getAdminOrder,
  getAdminOrdersSummary,
  getOrderActivity,
  listAdminOrders,
  rejectSupplierStock,
  recordOrderShipment,
  updateOrderPriority,
  updateOrderShippingAddress,
  type RecordShipmentInput,
} from "@/lib/api/admin-orders";
import { ApiError } from "@/lib/api/error";
import { formatCurrencyCents } from "@/lib/format";
import { matchStatusGroup, type OrderStatusGroup } from "@/lib/orders/status";
import { BulkStatusBar } from "./BulkStatusBar";
import { ConfirmSupplierDialog } from "./ConfirmSupplierDialog";
import { OrderFilters, type OrderFiltersValue } from "./OrderFilters";
import { OrderPriorityBadge } from "./OrderPriorityBadge";
import { OrderRowActions } from "./OrderRowActions";
import { OrderStatusBadge } from "./OrderStatusBadge";
import {
  OrderCustomerCell,
  OrderDateCell,
  OrderNumberCell,
  OrderStateCell,
  OrderTotalsCell,
  OrderTrackingCell,
} from "./OrderTableCells";
import { OrdersSummaryCards, type OrdersSummaryNavigation } from "./OrdersSummaryCards";
import { RejectSupplierDialog } from "./RejectSupplierDialog";

const OrderDetailPanel = dynamic(() => import("./OrderDetailPanel").then((mod) => mod.OrderDetailPanel), {
  ssr: false,
});

// Ids that wire each tab to the region it controls (WAI-ARIA tabs pattern).
const QUEUE_TAB_ID = "orders-tab-queue";
const ALL_TAB_ID = "orders-tab-all";
const ORDERS_PANEL_ID = "orders-tabpanel";

const PAGE_SIZE = 20;

/** How long a keystroke in "Buscar" waits before it becomes a request — see the `debouncedSearch` effect below. */
const SEARCH_DEBOUNCE_MS = 300;

type OrdersTab = "queue" | "all";

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

/** Module-level so its identity never changes — an inline `(order) => order.id` would defeat `DataTable`'s memoization on every render. */
function getOrderRowKey(order: AdminOrder): string {
  return order.id;
}

export interface OrdersViewProps {
  orderAuthAlertHours: number;
  orderAuthCancelHours: number;
}

/**
 * The orchestrator (DASHBOARD_GUIDELINES.md §3's template): tabs → filters →
 * dual mobile/desktop layout → pagination → lazy detail panel. "Todas" is
 * the default and first tab — the operation as a whole, not the exception
 * queue — with "Cola de proveedor" second, its badge fed by the same summary
 * fetch the KPI tiles use so the count is never a beat behind. Confirm/reject
 * dialogs live here, not inside a row or the detail panel, because both need
 * to trigger the exact same dialog instance for the same order.
 */
export function OrdersView({ orderAuthAlertHours, orderAuthCancelHours }: OrdersViewProps) {
  const { toast } = useToast();

  const [tab, setTab] = useState<OrdersTab>("all");
  const [filters, setFilters] = useState<OrderFiltersValue>({
    status: "",
    priority: "",
    orderNumber: "",
    search: "",
    sort: "-createdAt",
  });
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
  const [detailActivity, setDetailActivity] = useState<OrderActivityEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [everOpenedDetail, setEverOpenedDetail] = useState(false);

  // The unwindowed KPI summary — owned here, not by `OrdersSummaryCards`
  // itself, because the "Cola de proveedor" tab badge needs the exact same
  // `awaiting_supplier_confirmation` count the "Pendientes" tile shows. Two
  // consumers reading one fetch instead of two independent ones landing at
  // slightly different moments.
  const [summary, setSummary] = useState<AdminOrdersSummary | null>(null);

  // Same "adjust state when a prop changes" pattern as the list's own
  // `requestKey`/`lastRequestKey` below — clearing `summary` back to `null`
  // on every `refetchToken` bump (not just the first load) is what puts the
  // tiles back into their skeleton state while the effect re-fetches, so
  // stale KPI numbers never sit next to a table that just changed under them.
  const [lastSummaryToken, setLastSummaryToken] = useState<number | null>(null);
  if (refetchToken !== lastSummaryToken) {
    setLastSummaryToken(refetchToken);
    setSummary(null);
  }

  useEffect(() => {
    let cancelled = false;
    getAdminOrdersSummary()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        // Silent by design: the tiles are a shortcut, not a critical path —
        // the table below still loads independently on the same failure.
      });
    return () => {
      cancelled = true;
    };
  }, [refetchToken]);

  // A keystroke in "Buscar" updates `filters.search` (so the input stays
  // responsive) but only feeds `effectiveParams` — and so only reaches the
  // network — after the user pauses for `SEARCH_DEBOUNCE_MS`. Without this,
  // every keystroke would cancel and refire the list fetch.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

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
            ...(filters.status ? { status: filters.status.split(",") as OrderStatus[] } : {}),
            ...(filters.priority ? { priority: filters.priority } : {}),
            ...(filters.orderNumber.trim() ? { orderNumber: filters.orderNumber.trim().toUpperCase() } : {}),
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
          },
    [tab, page, filters, debouncedSearch],
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

  function switchTab(next: OrdersTab): void {
    setTab(next);
    setPage(1);
    setSelectedIds(new Set());
  }

  function updateFilters(next: OrderFiltersValue): void {
    setFilters(next);
    setPage(1);
  }

  /**
   * The order itself is the critical fetch — its failure closes the panel.
   * Activity ("Bitácora") is fetched right after, separately, and fails soft
   * into an empty list: it's supplementary context, not worth blocking or
   * closing an otherwise-loaded detail over.
   */
  const loadDetail = useCallback(
    async (id: string): Promise<void> => {
      setDetailLoading(true);
      try {
        const order = await getAdminOrder(id);
        setDetailOrder(order);
      } catch (error) {
        toast({ variant: "error", title: "No se pudo cargar la orden", description: apiErrorMessage(error, "Intenta de nuevo.") });
        setDetailOrderId(null);
        setDetailLoading(false);
        return;
      }
      setDetailLoading(false);

      try {
        setDetailActivity(await getOrderActivity(id));
      } catch {
        setDetailActivity([]);
      }
    },
    [toast],
  );

  // Stable across re-renders that don't touch `everOpenedDetail`/`loadDetail`
  // — this closure ends up inside `actionsColumn`/`orderCell`/`mobileRow`, so
  // keeping its identity stable is what lets those stay stable too, which is
  // what lets `DataTable` (now `React.memo`-wrapped) skip re-rendering every
  // row on a re-render this table's own content doesn't depend on.
  const openDetail = useCallback(
    (id: string): void => {
      if (!everOpenedDetail) setEverOpenedDetail(true);
      setDetailOrderId(id);
      setDetailOrder(null);
      setDetailActivity([]);
      void loadDetail(id);
    },
    [everOpenedDetail, loadDetail],
  );

  function closeDetail(): void {
    setDetailOrderId(null);
    setDetailOrder(null);
    setDetailActivity([]);
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

  /** Triage only — never touches `status`, so no bulk-endpoint detour like the "mark as X" buttons need. */
  async function handleUpdatePriority(id: string, priority: OrderPriority): Promise<boolean> {
    try {
      await updateOrderPriority(id, priority);
      toast({ variant: "success", title: "Prioridad actualizada" });
      refetch();
      await refetchDetailIfOpen(id);
      return true;
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo actualizar la prioridad",
        description: apiErrorMessage(error, "Intenta de nuevo."),
      });
      return false;
    }
  }

  /** No list refetch — a note doesn't change anything a table column shows, only the detail's own state. */
  async function handleAddNote(id: string, body: string): Promise<boolean> {
    try {
      await addOrderInternalNote(id, body);
      toast({ variant: "success", title: "Nota agregada" });
      await refetchDetailIfOpen(id);
      return true;
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo agregar la nota",
        description: apiErrorMessage(error, "Intenta de nuevo."),
      });
      return false;
    }
  }

  /** The four `StatCard`s jump straight to the view they summarize, rather than only informing — and to the exact status set they counted (`ORDER_STATUS_GROUPS`), so the tile's number and the list it opens can't disagree. */
  function handleSummaryNavigate(target: OrdersSummaryNavigation): void {
    if (target.tab === "queue") {
      switchTab("queue");
      return;
    }
    switchTab("all");
    updateFilters({ ...filters, status: target.status ? target.status.join(",") : "" });
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

  // Functional updater, so this never needs `selectedIds` itself as a
  // dependency — stable for the component's whole lifetime.
  const toggleSelected = useCallback((id: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isQueue = tab === "queue";

  /** Fed to `OrdersSummaryCards` so the tile matching the current view — the queue tab, or a "Todas" status filter that's exactly one whole group — reads as pressed. `null` when the list is filtered to something no tile represents (a single individual status, say). */
  const activeGroup: OrderStatusGroup | "queue" | null = isQueue ? "queue" : matchStatusGroup(filters.status);

  /** Only shown once loaded and only when there's actually something waiting — an empty/zero badge on "Cola de proveedor" would just be noise next to its own label. */
  const queueCount = summary?.countsByStatus.awaiting_supplier_confirmation;

  // A row's authorization clock and its supplier actions are both properties
  // of *that order's own status* now, not of which tab it's being viewed
  // from — the "Todas" tab used to hide both, which is exactly why an order
  // waiting on the supplier used to require a tab switch to act on.
  //
  // Everything from here down (`orderCell` through `mobileRow`) is memoized
  // — this is the table whose columns/row renderer used to be rebuilt from
  // scratch, with brand-new closures, on *every* render of a component that
  // holds 20+ pieces of state. Most of that state (detail-panel loading,
  // bulk-submit spinners, ...) has nothing to do with what a row renders;
  // memoizing the pieces that feed `DataTable` (now `React.memo`-wrapped) is
  // what lets an unrelated state change skip re-rendering every row instead
  // of recomputing and re-diffing all of them.
  const orderCell = useCallback(
    (order: AdminOrder): ReactNode => (
      <OrderNumberCell
        order={order}
        showCountdown={order.status === "authorized" || order.status === "awaiting_supplier_confirmation"}
        alertHours={orderAuthAlertHours}
        cancelHours={orderAuthCancelHours}
        onOpen={() => openDetail(order.id)}
      />
    ),
    [orderAuthAlertHours, orderAuthCancelHours, openDetail],
  );

  const actionsColumn: DataTableColumn<AdminOrder> = useMemo(
    () => ({
      key: "actions",
      header: "Acciones",
      kind: "actions",
      className: "w-px whitespace-nowrap",
      render: (order) => (
        <OrderRowActions
          showSupplierActions={order.status === "awaiting_supplier_confirmation"}
          busy={confirmDialogOrder?.id === order.id || rejectDialogOrder?.id === order.id}
          onConfirm={() => setConfirmDialogOrder({ id: order.id, orderNumber: order.orderNumber, totalCents: order.totals.totalCents })}
          onReject={() => setRejectDialogOrder({ id: order.id, orderNumber: order.orderNumber })}
        />
      ),
    }),
    [confirmDialogOrder, rejectDialogOrder],
  );

  // One column set for both tabs — the selection checkbox (bulk actions are
  // "Todas"-only: `BULK_ALLOWED_STATUSES` doesn't include the queue's pinned
  // `awaiting_supplier_confirmation`) is the only thing that differs, so a
  // tab switch no longer reflows the whole table from six columns to nine.
  const columns: DataTableColumn<AdminOrder>[] = useMemo(
    () => [
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
            } satisfies DataTableColumn<AdminOrder>,
          ]
        : []),
      { key: "order", header: "Orden", kind: "text", render: orderCell },
      { key: "date", header: "Fecha", kind: "text", render: (order) => <OrderDateCell iso={order.createdAt} /> },
      { key: "customer", header: "Cliente", kind: "text", render: (order) => <OrderCustomerCell order={order} /> },
      { key: "priority", header: "Prioridad", kind: "status", render: (order) => <OrderPriorityBadge priority={order.priority} /> },
      { key: "tracking", header: "Guía", kind: "text", render: (order) => <OrderTrackingCell order={order} /> },
      { key: "state", header: "Estatus", kind: "status", render: (order) => <OrderStateCell order={order} /> },
      { key: "total", header: "Total", kind: "number", render: (order) => <OrderTotalsCell order={order} /> },
      actionsColumn,
    ],
    [isQueue, selectedIds, toggleSelected, orderCell, actionsColumn],
  );

  const mobileRow = useCallback(
    (order: AdminOrder): ReactNode => (
      <button
        type="button"
        onClick={() => openDetail(order.id)}
        className="flex w-full items-center gap-sm px-md py-sm text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-ui text-ui text-negro">{order.orderNumber}</p>
          <p className="truncate font-body text-caption text-grafito">
            {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : "—"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-xs">
          <OrderStatusBadge status={order.status} />
          <span className="font-ui text-ui text-negro">{formatCurrencyCents(order.totals.totalCents)}</span>
        </div>
      </button>
    ),
    [openDetail],
  );

  // Row-to-row navigation inside the detail panel walks the currently-loaded
  // page only — `detailIndex === -1` (the open order isn't in this page,
  // e.g. it was opened before a filter change) simply renders no nav row,
  // handled by `OrderDetailPanel` itself once `position` is `undefined`.
  const detailIndex = orders.findIndex((order) => order.id === detailOrderId);
  const detailPosition = detailIndex >= 0 ? { index: detailIndex + 1, total: orders.length } : undefined;

  return (
    <>
      <div className="pt-md sm:pt-lg">
        <OrdersSummaryCards summary={summary} activeGroup={activeGroup} onNavigate={handleSummaryNavigate} />
      </div>

      {/* Real tab semantics, not `aria-current`: these swap the table in place,
          they don't navigate — a screen reader used to announce "current page"
          for a control that changes nothing about the page it's on. */}
      <TabList label="Vistas de órdenes" className="mt-lg px-md sm:px-lg">
        <Tab id={ALL_TAB_ID} panelId={ORDERS_PANEL_ID} selected={!isQueue} onSelect={() => switchTab("all")}>
          Todas
        </Tab>
        <Tab
          id={QUEUE_TAB_ID}
          panelId={ORDERS_PANEL_ID}
          selected={isQueue}
          onSelect={() => switchTab("queue")}
          badge={queueCount ? `(${queueCount})` : undefined}
        >
          Cola de proveedor
        </Tab>
      </TabList>

      {/* One panel for both tabs — they show the same table under different
          filters, so there is nothing to swap besides its contents. */}
      <div role="tabpanel" id={ORDERS_PANEL_ID} aria-labelledby={isQueue ? QUEUE_TAB_ID : ALL_TAB_ID}>
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
            <DataTableSkeleton columns={columns} mobile minWidthClassName="min-w-[64rem]" />
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
            <DataTable
              columns={columns}
              rows={orders}
              getRowKey={getOrderRowKey}
              mobileRow={mobileRow}
              onRowClick={(order) => openDetail(order.id)}
              minWidthClassName="min-w-[64rem]"
            />
          )}
        </div>
      </ErrorBoundary>

      <div className="px-md sm:px-lg">
        <Pagination meta={meta} onPageChange={setPage} />
      </div>
      </div>

      {everOpenedDetail ? (
        <OrderDetailPanel
          order={detailOrder}
          loading={detailLoading}
          activity={detailActivity}
          onClose={closeDetail}
          alertHours={orderAuthAlertHours}
          cancelHours={orderAuthCancelHours}
          position={detailPosition}
          onPrev={() => {
            const prevOrder = orders[detailIndex - 1];
            if (prevOrder) openDetail(prevOrder.id);
          }}
          onNext={() => {
            const nextOrder = orders[detailIndex + 1];
            if (nextOrder) openDetail(nextOrder.id);
          }}
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
          onUpdatePriority={(priority) =>
            detailOrderId ? handleUpdatePriority(detailOrderId, priority) : Promise.resolve(false)
          }
          onAddNote={(body) => (detailOrderId ? handleAddNote(detailOrderId, body) : Promise.resolve(false))}
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
