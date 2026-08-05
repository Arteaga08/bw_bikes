import type { StatsOverview, StatsRange } from "@bw-bikes/shared";
import { getOperationalAlerts } from "./alerts.stats.js";
import { getApplicationsStats } from "./applications.stats.js";
import { getInventoryStats } from "./inventory.stats.js";
import { getOrdersStats } from "./orders.stats.js";
import { getPreferencesStats } from "./preferences.stats.js";

/**
 * The composed panel — pure composition, and last in the module for a
 * reason: it adds no aggregation of its own. `range` is resolved **once** by
 * the caller (`parseStatsRange`, in the controller) and handed to every
 * module here unchanged, which is what guarantees two charts on this one
 * panel can never disagree about what "last 7 days" means. `alerts` is the
 * one exception, by design — see `alerts.stats.ts`.
 */
export async function getStatsOverview(range: StatsRange): Promise<StatsOverview> {
  const [orders, inventory, applications, preferences, alerts] = await Promise.all([
    getOrdersStats(range),
    getInventoryStats(range),
    getApplicationsStats(range),
    getPreferencesStats(range),
    getOperationalAlerts(),
  ]);

  return { range, orders, inventory, applications, preferences, alerts };
}
