"use client";

import type { OrdersStats, PreferenceProductRanking, StatsPreset } from "@bw-bikes/shared";
import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { OrdersByDayChart } from "@/components/charts/OrdersByDayChart";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { StatCard } from "@/components/ui/StatCard";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { type StatsRangeValue, StatsRangePicker } from "@/components/ui/StatsRangePicker";
import { formatCurrencyCents } from "@/lib/format";
import { getOrdersStats, getPreferencesStats } from "@/lib/api/admin-stats";

const DEFAULT_RANGE: StatsRangeValue = { preset: "30d" as StatsPreset };

/**
 * Below the alert row (Inicio's accionable half): the KPI/chart half, with
 * its own date window — never solapado with Analítica, que es el corte
 * completo del periodo. This is the day-to-day pulse: revenue, orders,
 * ticket, pending, and the top-5 sellers for the window.
 */
export function HomeStats() {
  const [range, setRange] = useState<StatsRangeValue>(DEFAULT_RANGE);
  const [orders, setOrders] = useState<OrdersStats | null>(null);
  const [topModels, setTopModels] = useState<PreferenceProductRanking[] | null>(null);

  const canFetch = range.preset !== "custom" || (range.from !== undefined && range.to !== undefined);

  const params = useMemo(
    () => ({ preset: range.preset, ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) }),
    [range],
  );

  const [lastParamsKey, setLastParamsKey] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params);
  if (canFetch && paramsKey !== lastParamsKey) {
    setLastParamsKey(paramsKey);
    setOrders(null);
    setTopModels(null);
  }

  useEffect(() => {
    if (!canFetch) return;
    let cancelled = false;
    Promise.all([getOrdersStats(params), getPreferencesStats(params)]).then(([ordersResult, preferences]) => {
      if (cancelled) return;
      setOrders(ordersResult);
      setTopModels(preferences.mostSoldModels.slice(0, 5));
    });
    return () => {
      cancelled = true;
    };
  }, [params, canFetch]);

  const pending =
    (orders?.countsByStatus.pending_payment ?? 0) +
    (orders?.countsByStatus.authorized ?? 0) +
    (orders?.countsByStatus.awaiting_supplier_confirmation ?? 0);
  const totalOrders = orders ? Object.values(orders.countsByStatus).reduce((sum, count) => sum + (count ?? 0), 0) : 0;

  return (
    <div className="flex flex-col gap-lg">
      <StatsRangePicker value={range} onChange={setRange} />

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
        {orders ? (
          <>
            <StatCard label="Ingresos" value={formatCurrencyCents(orders.revenueCents)} />
            <StatCard label="Órdenes" value={totalOrders} />
            <StatCard label="Ticket promedio" value={formatCurrencyCents(orders.averageOrderValueCents)} />
            <StatCard label="Pendientes" value={pending} tone={pending > 0 ? "advertencia" : "neutral"} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        )}
      </div>

      <div className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <ChartCard title="Órdenes por día" empty={orders !== null && orders.ordersByDay.length === 0}>
          {orders ? <OrdersByDayChart ordersByDay={orders.ordersByDay} /> : null}
        </ChartCard>
        <ChartCard title="Modelos más vendidos" empty={topModels !== null && topModels.length === 0}>
          {topModels ? (
            <RankedBarChart items={topModels.map((model) => ({ label: model.name, count: model.count }))} />
          ) : null}
        </ChartCard>
      </div>
    </div>
  );
}
