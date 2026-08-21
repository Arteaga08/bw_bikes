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
const ORDER_COUNT_FORMATTER = new Intl.NumberFormat("es-MX");

/**
 * Fixed gridline steps, in cents — not a scale relative to whatever this
 * render's peak happens to be: a ceiling that reshuffles itself every time
 * the data does is what made the old single "Ingresos por día" chart read as
 * noise rather than a trend (2026-08 Inicio redesign, at Manuel's request).
 *
 * The two charts deliberately do **not** share a step. Bikes clear $300k in a
 * 30-day window while accessories top out around $9k — two orders of
 * magnitude apart. A shared $50,000 step (which both charts used through
 * 2026-08) put the accessory chart's entire series below its first gridline,
 * flattening every bar onto the baseline. Each series now gets the step its
 * own scale calls for.
 *
 * The trade-off this accepts: bar heights are no longer comparable *across*
 * the two charts — half-height means $200k in one and $4.5k in the other.
 * Each chart is read against its own axis, which is why the axis labels are
 * always rendered rather than left implicit.
 */
const REVENUE_AXIS_STEP_CENTS = 50_000_00;
/**
 * $2,000, not $1,000: at accessories' real scale (~$9k/period), a $1,000
 * step draws 10 gridlines in a card this size — cramped, and it leaves the
 * tallest bar's ceiling landing on an exact multiple with zero headroom
 * above it (the mechanism that clipped its own value label — see
 * `OrdersByDayChart`'s `PADDING.top` doc comment). $2,000 halves the
 * gridline count and reliably leaves the ceiling above `rawMax`.
 */
const ACCESSORY_REVENUE_AXIS_STEP_CENTS = 2_000_00;

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
  const orderCountSeries = useMemo(
    () => orders?.ordersByDay.map((day) => ({ date: day.date, value: day.count })) ?? [],
    [orders],
  );
  const bikeRevenueSeries = useMemo(
    () => orders?.ordersByDay.map((day) => ({ date: day.date, value: day.bikeRevenueCents })) ?? [],
    [orders],
  );
  const accessoryRevenueSeries = useMemo(
    () => orders?.ordersByDay.map((day) => ({ date: day.date, value: day.accessoryRevenueCents })) ?? [],
    [orders],
  );
  // The one chart input in this file that wasn't memoized like the four
  // series above — same reasoning: a fresh array/objects on every render
  // otherwise, fed straight into `RankedBarChart`.
  const topModelItems = useMemo(
    () =>
      topModels?.map((model) => ({
        label: model.name,
        count: model.count,
        itemType: model.itemType,
        revenueCents: model.revenueCents,
        formatRevenue: formatCurrencyCents,
      })) ?? [],
    [topModels],
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
                  spark={
                    <Sparkline
                      points={revenueSeries}
                      ariaLabel="Tendencia de ingresos en el periodo"
                      formatValue={formatCompactCurrencyCents}
                    />
                  }
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
                      points={orderCountSeries}
                      ariaLabel="Tendencia de órdenes en el periodo"
                      formatValue={(value) => ORDER_COUNT_FORMATTER.format(value)}
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

          {/*
            Two separate charts, not one two-series chart or a stacked bar —
            decided with Manuel: bikes and accessories are different enough
            in ticket size (two orders of magnitude apart) that overlaying
            them, or sharing one y-axis step, would bury the accessory bars
            under the bike ones. Each chart now uses the fixed step its own
            scale calls for (`REVENUE_AXIS_STEP_CENTS` /
            `ACCESSORY_REVENUE_AXIS_STEP_CENTS`, above) — same currency,
            different steps, not directly comparable bar-to-bar across the
            two charts. Neither total sums to the "Ingresos" KPI above:
            shipping is an order-level charge, not a product line, so it
            belongs to neither chart — each subtitle says so rather than
            leaving two numbers that silently don't add up.
          */}
          <div className="grid grid-cols-1 gap-md xl:grid-cols-2">
            <ChartCard
              title="Ingresos por bicicletas"
              subtitle="No incluye envío"
              empty={orders !== null && bikeRevenueSeries.every((point) => point.value === 0)}
            >
              {orders ? (
                <OrdersByDayChart
                  data={bikeRevenueSeries}
                  range={orders.range}
                  formatValue={formatCurrencyCents}
                  formatAxisValue={formatCompactCurrencyCents}
                  ariaLabel="Ingresos por bicicletas, por día"
                  axisStep={REVENUE_AXIS_STEP_CENTS}
                />
              ) : null}
            </ChartCard>
            <ChartCard
              title="Ingresos por accesorios"
              subtitle="No incluye envío"
              empty={orders !== null && accessoryRevenueSeries.every((point) => point.value === 0)}
            >
              {orders ? (
                <OrdersByDayChart
                  data={accessoryRevenueSeries}
                  range={orders.range}
                  formatValue={formatCurrencyCents}
                  formatAxisValue={formatCompactCurrencyCents}
                  ariaLabel="Ingresos por accesorios, por día"
                  axisStep={ACCESSORY_REVENUE_AXIS_STEP_CENTS}
                />
              ) : null}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-md xl:grid-cols-2">
            <RecentOrdersList />
            <ChartCard title="Modelos más vendidos" empty={topModels !== null && topModels.length === 0}>
              {topModels ? <RankedBarChart items={topModelItems} /> : null}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
