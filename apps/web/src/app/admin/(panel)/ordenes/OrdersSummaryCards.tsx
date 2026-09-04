"use client";

import type { AdminOrdersSummary, OrderStatus } from "@bw-bikes/shared";
import { StatCard } from "@/components/ui/StatCard";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { ORDER_STATUS_GROUPS, type OrderStatusGroup } from "@/lib/orders/status";

export interface OrdersSummaryNavigation {
  tab: "queue" | "all";
  status?: readonly OrderStatus[];
}

export interface OrdersSummaryCardsProps {
  /** `null` while loading — `OrdersView` owns the fetch (shared with the "Cola de proveedor" tab badge, which needs the same count) and hands the settled value down. */
  summary: AdminOrdersSummary | null;
  /** Which bucket the list is currently showing, if any — the queue tab, or a group whose csv exactly matches the "Todas" status filter (`matchStatusGroup`). Highlights that tile so "I clicked here" and "I'm looking at this" stay the same tile. */
  activeGroup: OrderStatusGroup | "queue" | null;
  onNavigate: (target: OrdersSummaryNavigation) => void;
}

/**
 * The four KPI tiles atop `/admin/ordenes`, fed by `GET /admin/orders/summary`
 * — unwindowed by date on purpose (see that endpoint's own doc comment), so
 * an order stuck for two months still counts. Grouped by what an operator
 * does next, not by raw `OrderStatus` — the exact buckets `ORDER_STATUS_GROUPS`
 * names, so a tile's count and the status list it navigates to can never
 * drift apart (the bug this replaced: "Pagos" used to count `paid +
 * processing` but link to `status=paid` alone):
 *
 * - **Pendientes**: `ORDER_STATUS_GROUPS.action` — needs a human decision or
 *   is still waiting on the customer's card. Navigates to the queue tab, not
 *   a status filter, since that tab is already pinned to exactly this set.
 * - **Pagos**: `ORDER_STATUS_GROUPS.progress` — money captured, still in the
 *   shop. `exito` tone when there's at least one.
 * - **Envíos**: `ORDER_STATUS_GROUPS.shipping` — on its way or delivered.
 *   Same `exito` tone when there's at least one.
 * - **Problemas**: `ORDER_STATUS_GROUPS.problems` + unresolved/lost disputes.
 *   `disputed` now excludes a dispute the shop won or that was withdrawn
 *   (`AdminOrdersSummary.disputed`'s own doc) — but it can still double-count
 *   a `refunded` order whose dispute Stripe hasn't closed yet: the backend
 *   only tracks *its own* refund decision on `status`, and a dispute's
 *   `open`/`lost` outcome independently, on `disputeStatus`. A manual refund
 *   issued before Stripe resolves the chargeback leaves both true at once.
 *   Narrow enough a window not to be worth reconciling here.
 */
export function OrdersSummaryCards({ summary, activeGroup, onNavigate }: OrdersSummaryCardsProps) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-md px-md sm:grid-cols-4 sm:px-lg">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  const { countsByStatus, disputed, expiringAuthorizations } = summary;

  const pending = ORDER_STATUS_GROUPS.action.reduce((sum, status) => sum + countsByStatus[status], 0);
  const paidBucket = ORDER_STATUS_GROUPS.progress.reduce((sum, status) => sum + countsByStatus[status], 0);
  const shippedBucket = ORDER_STATUS_GROUPS.shipping.reduce((sum, status) => sum + countsByStatus[status], 0);
  const problems = ORDER_STATUS_GROUPS.problems.reduce((sum, status) => sum + countsByStatus[status], 0) + disputed;

  return (
    <div className="grid grid-cols-2 gap-md px-md sm:grid-cols-4 sm:px-lg">
      <StatCard
        label="Pendientes"
        value={pending}
        hint={expiringAuthorizations > 0 ? `${expiringAuthorizations} por vencer` : "Ninguna por vencer"}
        tone={expiringAuthorizations > 0 ? "advertencia" : "neutral"}
        active={activeGroup === "queue"}
        onClick={() => onNavigate({ tab: "queue" })}
      />
      <StatCard
        label="Pagos"
        value={paidBucket}
        hint="Cobradas, aún en casa"
        tone={paidBucket > 0 ? "exito" : "neutral"}
        active={activeGroup === "progress"}
        onClick={() => onNavigate({ tab: "all", status: ORDER_STATUS_GROUPS.progress })}
      />
      <StatCard
        label="Envíos"
        value={shippedBucket}
        hint="En camino o entregadas"
        tone={shippedBucket > 0 ? "exito" : "neutral"}
        active={activeGroup === "shipping"}
        onClick={() => onNavigate({ tab: "all", status: ORDER_STATUS_GROUPS.shipping })}
      />
      <StatCard
        label="Problemas"
        value={problems}
        hint={disputed > 0 ? `${disputed} con contracargo` : "Sin contracargos"}
        tone={problems > 0 ? "error" : "neutral"}
        active={activeGroup === "problems"}
        onClick={() => onNavigate({ tab: "all", status: ORDER_STATUS_GROUPS.problems })}
      />
    </div>
  );
}
