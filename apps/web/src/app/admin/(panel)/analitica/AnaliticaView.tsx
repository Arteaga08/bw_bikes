"use client";

import type { StatsOverview, StatsPreset } from "@bw-bikes/shared";
import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { StatCard } from "@/components/ui/StatCard";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { type StatsRangeValue, StatsRangePicker } from "@/components/ui/StatsRangePicker";
import { getStatsOverview } from "@/lib/api/admin-stats";
import { ALL_ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/orders/status";

const DEFAULT_RANGE: StatsRangeValue = { preset: "30d" as StatsPreset };

/**
 * The historical corte — Inicio is the day's pulse, this is the whole
 * period. One call to `/admin/stats/overview` (it resolves the window once
 * and shares it across every module) instead of stitching five separate
 * fetches together, which is exactly what that endpoint exists to prevent.
 */
export function AnaliticaView() {
  const [range, setRange] = useState<StatsRangeValue>(DEFAULT_RANGE);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [loadError, setLoadError] = useState(false);

  const canFetch = range.preset !== "custom" || (range.from !== undefined && range.to !== undefined);

  const params = useMemo(
    () => ({ preset: range.preset, ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) }),
    [range],
  );

  const paramsKey = JSON.stringify(params);
  const [lastParamsKey, setLastParamsKey] = useState<string | null>(null);
  if (canFetch && paramsKey !== lastParamsKey) {
    setLastParamsKey(paramsKey);
    setOverview(null);
    setLoadError(false);
  }

  useEffect(() => {
    if (!canFetch) return;
    let cancelled = false;
    getStatsOverview(params)
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [params, canFetch]);

  // Same reasoning as `HomeStats.tsx`'s series `useMemo`s — four fresh
  // arrays otherwise, fed straight into four `RankedBarChart` instances on
  // every render.
  const mostViewedModelItems = useMemo(
    () => overview?.preferences.mostViewedModels.map((model) => ({ label: model.name, count: model.count })) ?? [],
    [overview],
  );
  const mostSoldModelItems = useMemo(
    () => overview?.preferences.mostSoldModels.map((model) => ({ label: model.name, count: model.count })) ?? [],
    [overview],
  );
  const mostViewedSizeItems = useMemo(
    () => overview?.preferences.mostViewedSizes.map((size) => ({ label: size.size, count: size.count })) ?? [],
    [overview],
  );
  const mostSoldSizeItems = useMemo(
    () => overview?.preferences.mostSoldSizes.map((size) => ({ label: size.size, count: size.count })) ?? [],
    [overview],
  );

  return (
    <div className="flex flex-col gap-lg p-md sm:p-lg">
      <StatsRangePicker value={range} onChange={setRange} />

      {loadError ? (
        <p className="font-body text-body text-estado-error">No se pudo cargar la analítica. Intenta de nuevo.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
            {overview ? (
              <>
                <StatCard label="Unidades comprometidas" value={overview.inventory.unitsCommitted} />
                <StatCard
                  label="SKUs agotados"
                  value={overview.inventory.outOfStockSkus}
                  tone={overview.inventory.outOfStockSkus > 0 ? "error" : "neutral"}
                />
                <StatCard
                  label="SKUs bajos"
                  value={overview.inventory.lowStockSkus}
                  tone={overview.inventory.lowStockSkus > 0 ? "advertencia" : "neutral"}
                />
                <StatCard label="Solicitudes recibidas" value={overview.applications.submitted} />
              </>
            ) : (
              Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
            )}
          </div>

          <div className="grid grid-cols-1 gap-md xl:grid-cols-2">
            <ChartCard title="Modelos más vistos" empty={overview !== null && overview.preferences.mostViewedModels.length === 0}>
              {overview ? <RankedBarChart items={mostViewedModelItems} /> : null}
            </ChartCard>
            <ChartCard title="Modelos más vendidos" empty={overview !== null && overview.preferences.mostSoldModels.length === 0}>
              {overview ? <RankedBarChart items={mostSoldModelItems} /> : null}
            </ChartCard>
            <ChartCard title="Tallas más vistas" empty={overview !== null && overview.preferences.mostViewedSizes.length === 0}>
              {overview ? <RankedBarChart items={mostViewedSizeItems} /> : null}
            </ChartCard>
            <ChartCard title="Tallas más vendidas" empty={overview !== null && overview.preferences.mostSoldSizes.length === 0}>
              {overview ? <RankedBarChart items={mostSoldSizeItems} /> : null}
            </ChartCard>
          </div>

          <ChartCard title="Órdenes por estatus">
            {overview ? (
              <table className="w-full text-left">
                <tbody>
                  {ALL_ORDER_STATUSES.map((status) => (
                    <tr key={status} className="border-b border-borde last:border-b-0">
                      <td className="py-xs font-body text-body text-negro capitalize">{ORDER_STATUS_LABELS[status]}</td>
                      <td className="py-xs text-right font-body text-body text-negro tabular-nums">
                        {overview.orders.countsByStatus[status] ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </ChartCard>
        </>
      )}
    </div>
  );
}
