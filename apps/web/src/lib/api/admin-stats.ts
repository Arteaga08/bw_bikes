import type {
  ApplicationsStats,
  InventoryStats,
  OperationalAlerts,
  OrdersStats,
  PreferencesStats,
  StatsOverview,
  StatsPreset,
} from "@bw-bikes/shared";
import { apiFetch } from "./client";

export interface StatsRangeParams {
  preset?: StatsPreset;
  /** Required together with `to` when `preset === "custom"` — ISO date, inclusive. */
  from?: string;
  /** ISO date, exclusive. */
  to?: string;
}

/** Mirrors `statsRangeQuerySchema` — every `/admin/stats/*` module endpoint but `/alerts` takes this same whitelist. */
function buildStatsRangeQuery(params: StatsRangeParams): string {
  const entries: Array<[string, string]> = [];
  if (params.preset) entries.push(["preset", params.preset]);
  if (params.from) entries.push(["from", params.from]);
  if (params.to) entries.push(["to", params.to]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

export async function getOrdersStats(params: StatsRangeParams): Promise<OrdersStats> {
  const { data } = await apiFetch<{ stats: OrdersStats }>(`/admin/stats/orders${buildStatsRangeQuery(params)}`);
  return data.stats;
}

export async function getInventoryStats(params: StatsRangeParams): Promise<InventoryStats> {
  const { data } = await apiFetch<{ stats: InventoryStats }>(`/admin/stats/inventory${buildStatsRangeQuery(params)}`);
  return data.stats;
}

export async function getApplicationsStats(params: StatsRangeParams): Promise<ApplicationsStats> {
  const { data } = await apiFetch<{ stats: ApplicationsStats }>(
    `/admin/stats/applications${buildStatsRangeQuery(params)}`,
  );
  return data.stats;
}

export async function getPreferencesStats(params: StatsRangeParams): Promise<PreferencesStats> {
  const { data } = await apiFetch<{ stats: PreferencesStats }>(
    `/admin/stats/preferences${buildStatsRangeQuery(params)}`,
  );
  return data.stats;
}

/** Unwindowed on purpose (see `OperationalAlerts`'s own doc comment in shared) — no range params to send. */
export async function getOperationalAlerts(): Promise<OperationalAlerts> {
  const { data } = await apiFetch<{ alerts: OperationalAlerts }>("/admin/stats/alerts");
  return data.alerts;
}

/** Resolves the date window once and shares it across every module — the call `/admin/analitica` builds on. */
export async function getStatsOverview(params: StatsRangeParams): Promise<StatsOverview> {
  const { data } = await apiFetch<{ overview: StatsOverview }>(`/admin/stats/overview${buildStatsRangeQuery(params)}`);
  return data.overview;
}
