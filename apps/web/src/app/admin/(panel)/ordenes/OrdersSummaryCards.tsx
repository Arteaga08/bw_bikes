"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { getAdminOrdersSummary } from "@/lib/api/admin-orders";

export interface OrdersSummaryNavigation {
  tab: "queue" | "all";
  status?: "paid" | "shipped" | "cancelled";
}

export interface OrdersSummaryCardsProps {
  /** Bumped by `OrdersView` after any action that could move an order between buckets, so the tiles never go stale next to a table that just refetched. */
  refetchToken: number;
  onNavigate: (target: OrdersSummaryNavigation) => void;
}

/**
 * The four KPI tiles atop `/admin/ordenes`, fed by `GET /admin/orders/summary`
 * — unwindowed by date on purpose (see that endpoint's own doc comment), so
 * an order stuck for two months still counts. Grouped by what an operator
 * does next, not by raw `OrderStatus`:
 *
 * - **Pendientes**: needs a human decision or is still waiting on the
 *   customer's card (`pending_payment` + `authorized` +
 *   `awaiting_supplier_confirmation`).
 * - **Pagos**: money captured, still in the shop (`paid` + `processing`).
 *   `exito` tone when there's at least one — the shop is taking money.
 * - **Envíos**: on its way or delivered (`shipped` + `delivered`). Same
 *   `exito` tone when there's at least one — orders are actually moving.
 * - **Problemas**: anything that ended badly (`cancelled` +
 *   `authorization_expired` + `refunded` + open disputes). `disputed` can
 *   double-count a `refunded` order that was also disputed — the backend has
 *   no "dispute resolved" flag to disambiguate, an existing gap, not one this
 *   tile tries to fix.
 */
export function OrdersSummaryCards({ refetchToken, onNavigate }: OrdersSummaryCardsProps) {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAdminOrdersSummary>> | null>(null);
  const [loading, setLoading] = useState(true);

  // Same "adjust state during render" pattern as `OrdersView`'s own
  // `requestKey`/`lastRequestKey` — `react-hooks/set-state-in-effect` (active
  // since M8) rejects a plain `setLoading(true)` at the top of the effect
  // body.
  const [lastToken, setLastToken] = useState<number | null>(null);
  if (refetchToken !== lastToken) {
    setLastToken(refetchToken);
    setLoading(true);
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
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refetchToken]);

  if (loading || !summary) {
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

  const pending = countsByStatus.pending_payment + countsByStatus.authorized + countsByStatus.awaiting_supplier_confirmation;
  const paidBucket = countsByStatus.paid + countsByStatus.processing;
  const shippedBucket = countsByStatus.shipped + countsByStatus.delivered;
  const problems = countsByStatus.cancelled + countsByStatus.authorization_expired + countsByStatus.refunded + disputed;

  return (
    <div className="grid grid-cols-2 gap-md px-md sm:grid-cols-4 sm:px-lg">
      <StatCard
        label="Pendientes"
        value={pending}
        hint={expiringAuthorizations > 0 ? `${expiringAuthorizations} por vencer` : "Ninguna por vencer"}
        tone={expiringAuthorizations > 0 ? "advertencia" : "neutral"}
        onClick={() => onNavigate({ tab: "queue" })}
      />
      <StatCard
        label="Pagos"
        value={paidBucket}
        hint="Cobradas, aún en casa"
        tone={paidBucket > 0 ? "exito" : "neutral"}
        onClick={() => onNavigate({ tab: "all", status: "paid" })}
      />
      <StatCard
        label="Envíos"
        value={shippedBucket}
        hint="En camino o entregadas"
        tone={shippedBucket > 0 ? "exito" : "neutral"}
        onClick={() => onNavigate({ tab: "all", status: "shipped" })}
      />
      <StatCard
        label="Problemas"
        value={problems}
        hint={disputed > 0 ? `${disputed} con contracargo` : "Sin contracargos"}
        tone={problems > 0 ? "error" : "neutral"}
        onClick={() => onNavigate({ tab: "all", status: "cancelled" })}
      />
    </div>
  );
}
