"use client";

import type { OrdersStats, PreferenceProductRanking, StatsPreset } from "@bw-bikes/shared";
import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { OrdersByDayChart } from "@/components/charts/OrdersByDayChart";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { DeltaIndicator } from "@/components/ui/DeltaIndicator";
import { StatCard } from "@/components/ui/StatCard";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { type StatsRangeValue, StatsRangePicker } from "@/components/ui/StatsRangePicker";
import { formatCompactCurrencyCents, formatCurrencyCents } from "@/lib/format";
import { getOrdersStats, getPreferencesStats } from "@/lib/api/admin-stats";
import { RecentOrdersList } from "./RecentOrdersList";

const DEFAULT_RANGE: StatsRangeValue = { preset: "30d" as StatsPreset };
const PERIOD_LABEL = "vs. periodo anterior";

/**
 * Below the operations strip (Inicio's accionable half): the business-pulse
 * half, with its own date window — never solapado with Analítica, que es el
 * corte completo del periodo. Every headline figure here carries a
 * `DeltaIndicator` against the immediately-preceding window of equal
 * length (`OrdersStats.previous`, resolved server-side in
 * `orders.stats.ts`) — a number alone was the core problem with the old
 * Inicio: nothing said whether $X was good or bad.
 */
export function HomeStats() {
  const [range, setRange] = useState<StatsRangeValue>(DEFAULT_RANGE);
  const [orders, setOrders] = useState<OrdersStats | null>(null);
  const [topModels, setTopModels] = useState<PreferenceProductRanking[] | null>(null);
  const [loadError, setLoadError] = useState(false);

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
    setLoadError(false);
  }

  useEffect(() => {
    if (!canFetch) return;
    let cancelled = false;
    Promise.all([getOrdersStats(params), getPreferencesStats(params)])
      .then(([ordersResult, preferences]) => {
        if (cancelled) return;
        setOrders(ordersResult);
        setTopModels(preferences.mostSoldModels.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [params, canFetch]);

  const totalOrders = orders ? Object.values(orders.countsByStatus).reduce((sum, count) => sum + (count ?? 0), 0) : 0;
  const completedOrders = orders ? (orders.countsByStatus.shipped ?? 0) + (orders.countsByStatus.delivered ?? 0) : 0;
  const completedRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

  const revenueSeries = useMemo(
    () => orders?.ordersByDay.map((day) => ({ date: day.date, value: day.revenueCents })) ?? [],
    [orders],
  );

  return (
    <div className="flex flex-col gap-lg">
      <StatsRangePicker value={range} onChange={setRange} />

      {loadError ? (
        <p className="font-body text-body text-estado-error">No se pudo cargar el resumen. Intenta de nuevo.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
            {orders ? (
              <>
                <StatCard
                  label="Ingresos"
                  value={formatCurrencyCents(orders.revenueCents)}
                  delta={
                    <DeltaIndicator
                      current={orders.revenueCents}
                      previous={orders.previous?.revenueCents ?? null}
                      periodLabel={PERIOD_LABEL}
                    />
                  }
                  spark={<Sparkline points={revenueSeries} ariaLabel="Tendencia de ingresos en el periodo" />}
                />
                <StatCard
                  label="Órdenes"
                  value={totalOrders}
                  delta={
                    <DeltaIndicator
                      current={totalOrders}
                      previous={orders.previous?.orderCount ?? null}
                      periodLabel={PERIOD_LABEL}
                    />
                  }
                  spark={
                    <Sparkline
                      points={orders.ordersByDay.map((day) => ({ date: day.date, value: day.count }))}
                      ariaLabel="Tendencia de órdenes en el periodo"
                    />
                  }
                />
                <StatCard
                  label="Ticket promedio"
                  value={formatCurrencyCents(orders.averageOrderValueCents)}
                  delta={
                    <DeltaIndicator
                      current={orders.averageOrderValueCents}
                      previous={orders.previous?.averageOrderValueCents ?? null}
                      periodLabel={PERIOD_LABEL}
                    />
                  }
                />
                <StatCard
                  label="Órdenes completadas"
                  value={`${completedRate}%`}
                  hint={totalOrders > 0 ? `${completedOrders} de ${totalOrders} órdenes` : "Sin órdenes en el periodo"}
                />
              </>
            ) : (
              Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
            )}
          </div>

          <div className="grid grid-cols-1 gap-md xl:grid-cols-2">
            <ChartCard
              title="Ingresos por día"
              subtitle={orders ? `${orders.ordersByDay.length} ${orders.ordersByDay.length === 1 ? "día" : "días"} con actividad` : undefined}
              empty={orders !== null && orders.ordersByDay.length === 0}
            >
              {orders ? (
                <OrdersByDayChart
                  data={revenueSeries}
                  range={orders.range}
                  formatValue={formatCurrencyCents}
                  formatAxisValue={formatCompactCurrencyCents}
                  ariaLabel="Ingresos por día"
                  tooltipDetail={(_, index) => {
                    const day = orders.ordersByDay[index];
                    if (!day) return undefined;
                    return `${day.count} ${day.count === 1 ? "orden" : "órdenes"}`;
                  }}
                />
              ) : null}
            </ChartCard>
            <RecentOrdersList />
          </div>

          <ChartCard title="Modelos más vendidos" empty={topModels !== null && topModels.length === 0}>
            {topModels ? (
              <RankedBarChart items={topModels.map((model) => ({ label: model.name, count: model.count }))} />
            ) : null}
          </ChartCard>
        </>
      )}
    </div>
  );
}
