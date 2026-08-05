import type { OrderStatus, OrdersStats, StatsRange } from "@bw-bikes/shared";
import { Order } from "../../models/index.js";
import { ORDER_STATUSES } from "../order-state.js";

/**
 * Statuses where money is currently captured and has not been given back.
 * `refunded` is deliberately excluded from revenue — the money moved back
 * out, so counting it would overstate what the shop actually took in.
 */
const REVENUE_STATUSES: OrderStatus[] = ["paid", "processing", "shipped", "delivered"];

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
}

/**
 * Everything in this module is windowed by `Order.createdAt` — when the
 * order was placed, not when it later moved status. All three queries run
 * against the exact same `range` the caller resolved once
 * (`parseStatsRange`), so this and `getInventoryStats`/`getApplicationsStats`
 * can never disagree about what the window means.
 */
export async function getOrdersStats(range: StatsRange): Promise<OrdersStats> {
  const windowFilter = { createdAt: { $gte: new Date(range.from), $lt: new Date(range.to) } };

  const [statusRows, revenueRows, dailyRows] = await Promise.all([
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
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).exec(),
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
    ordersByDay: dailyRows.map((row) => ({ date: row._id, count: row.count })),
  };
}
