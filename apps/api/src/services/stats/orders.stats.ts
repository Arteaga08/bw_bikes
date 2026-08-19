import type { OrderStatus, OrdersStats, OrdersStatsPrevious, StatsRange } from "@bw-bikes/shared";
import { Order } from "../../models/index.js";
import { ORDER_STATUSES } from "../order-state.js";

/**
 * Statuses where money is currently captured and has not been given back.
 * `refunded` is deliberately excluded from revenue — the money moved back
 * out, so counting it would overstate what the shop actually took in.
 */
const REVENUE_STATUSES: OrderStatus[] = ["paid", "processing", "shipped", "delivered"];

/**
 * Every day-boundary calculation in this module ($dateToString and the
 * "today" preset both) uses store time, not UTC — otherwise a "today" filter
 * (computed server-local in `stats-range.ts`) and the daily series it's
 * charted against would disagree about where midnight falls, by up to the
 * ~6h UTC offset this store operates under.
 */
const STORE_TIMEZONE = "America/Mexico_City";

interface StatusCountRow {
  _id: OrderStatus;
  count: number;
}

interface RevenueRow {
  revenueCents: number;
  orders: number;
}

interface DailyRow {
  _id: string;
  count: number;
  revenueCents: number;
}

/** `$cond`-summed revenue, reused for both the aggregate total and the per-day series. */
const REVENUE_SUM_EXPR = {
  $sum: { $cond: [{ $in: ["$status", REVENUE_STATUSES] }, "$totalCents", 0] },
};

function windowFilterFor(range: Pick<StatsRange, "from" | "to">) {
  return { createdAt: { $gte: new Date(range.from), $lt: new Date(range.to) } };
}

/**
 * The window of identical duration immediately preceding `range` — the
 * baseline a headline figure needs to read as "up" or "down" rather than a
 * bare number. `[previousFrom, from)`, so the two windows never overlap and
 * never leave a gap.
 */
function previousWindowFor(range: StatsRange): { from: Date; to: Date } {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const durationMs = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - durationMs), to: from };
}

async function getPreviousTotals(range: StatsRange): Promise<OrdersStatsPrevious | null> {
  const previous = previousWindowFor(range);
  const windowFilter = windowFilterFor({ from: previous.from.toISOString(), to: previous.to.toISOString() });

  const revenueRows = await Order.aggregate<RevenueRow>([
    { $match: windowFilter },
    { $group: { _id: null, revenueCents: REVENUE_SUM_EXPR, orders: { $sum: 1 } } },
  ]).exec();

  const row = revenueRows[0];
  // No orders at all in the previous window is a different statement than
  // "zero revenue" — a percentage against no baseline is undefined, not 0%,
  // and the caller (DeltaIndicator) has to be able to tell the two apart.
  if (!row || row.orders === 0) return null;

  return {
    revenueCents: row.revenueCents,
    orderCount: row.orders,
    averageOrderValueCents: Math.round(row.revenueCents / row.orders),
  };
}

/**
 * Everything in this module is windowed by `Order.createdAt` — when the
 * order was placed, not when it later moved status. All queries run against
 * the exact same `range` the caller resolved once (`parseStatsRange`), so
 * this and `getInventoryStats`/`getApplicationsStats` can never disagree
 * about what the window means.
 */
export async function getOrdersStats(range: StatsRange): Promise<OrdersStats> {
  const windowFilter = windowFilterFor(range);

  const [statusRows, revenueRows, dailyRows, previous] = await Promise.all([
    Order.aggregate<StatusCountRow>([
      { $match: windowFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).exec(),
    Order.aggregate<RevenueRow>([
      { $match: { ...windowFilter, status: { $in: REVENUE_STATUSES } } },
      { $group: { _id: null, revenueCents: { $sum: "$totalCents" }, orders: { $sum: 1 } } },
    ]).exec(),
    Order.aggregate<DailyRow>([
      { $match: windowFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: STORE_TIMEZONE } },
          count: { $sum: 1 },
          revenueCents: REVENUE_SUM_EXPR,
        },
      },
      { $sort: { _id: 1 } },
    ]).exec(),
    getPreviousTotals(range),
  ]);

  const countsByStatus: Partial<Record<OrderStatus, number>> = {};
  for (const status of ORDER_STATUSES) countsByStatus[status] = 0;
  for (const row of statusRows) countsByStatus[row._id] = row.count;

  const revenue = revenueRows[0];
  const revenueCents = revenue?.revenueCents ?? 0;
  const revenueOrderCount = revenue?.orders ?? 0;

  return {
    range,
    countsByStatus,
    revenueCents,
    averageOrderValueCents: revenueOrderCount > 0 ? Math.round(revenueCents / revenueOrderCount) : 0,
    ordersByDay: dailyRows.map((row) => ({ date: row._id, count: row.count, revenueCents: row.revenueCents })),
    previous,
  };
}
