import type { CustomersStats, TopBuyerRow } from "@bw-bikes/shared";
import type { StatsRange } from "@bw-bikes/shared";
import { Order, User } from "../../models/index.js";
import { IS_REVENUE_EXPR, REVENUE_MATCH, REVENUE_STATUSES } from "./orders.stats.js";

/** Same ceiling every other ranking uses — a chart, not a full table scan. */
const MAX_RANKING_ITEMS = 10;

/**
 * "Compró" is a broader question than "pagó", exactly as in
 * `preferences.stats.ts`: a refunded order still means this person bought,
 * so it counts toward being a buyer and a repeat buyer, but never toward
 * money the shop kept.
 */
const PURCHASE_STATUSES = [...REVENUE_STATUSES, "refunded"];

function windowFilter(range: StatsRange, field: string) {
  return { [field]: { $gte: new Date(range.from), $lt: new Date(range.to) } };
}

interface TopBuyerGroupRow {
  _id: string;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: Date;
}

/**
 * The "mejores compradores" ranking, by money kept rather than by order count.
 *
 * Ranking by number of orders would put someone who bought ten $400 helmets
 * above someone who bought a $200,000 bike — the opposite of who the shop
 * wants to reward. `REVENUE_MATCH` is imported, never restated, so this
 * ranking can't drift from the revenue chart it sits next to.
 */
async function getTopBuyers(range: StatsRange): Promise<TopBuyerRow[]> {
  const rows = await Order.aggregate<TopBuyerGroupRow>([
    { $match: { ...REVENUE_MATCH, ...windowFilter(range, "createdAt") } },
    {
      $group: {
        _id: "$userId",
        orderCount: { $sum: 1 },
        totalSpentCents: { $sum: "$totalCents" },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
    { $sort: { totalSpentCents: -1 } },
    { $limit: MAX_RANKING_ITEMS },
  ]).exec();

  if (rows.length === 0) return [];

  // One bounded batch lookup for the names, the same shape
  // `resolveProductLabels` uses — never one query per ranked row.
  const users = await User.find({ _id: { $in: rows.map((row) => row._id) } }, "firstName lastName email")
    .lean()
    .exec();
  const byId = new Map(users.map((user) => [String(user._id), user]));

  const ranked: TopBuyerRow[] = [];
  for (const row of rows) {
    const user = byId.get(String(row._id));
    // A deleted account would leave a nameless row; dropping it beats
    // rendering a ranking entry nobody can act on.
    if (!user) continue;
    ranked.push({
      userId: String(row._id),
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      orderCount: row.orderCount,
      totalSpentCents: row.totalSpentCents,
      lastOrderAt: row.lastOrderAt.toISOString(),
    });
  }
  return ranked;
}

interface SegmentRow {
  _id: null;
  buyers: number;
  repeatBuyers: number;
  revenueCents: number;
  revenueOrders: number;
}

/**
 * Buyers, repeat buyers and the average ticket, in one pass.
 *
 * The two-stage group is what makes "más de una vez" answerable: the first
 * collapses orders per customer, the second counts how many of those
 * customers cleared two purchases. Doing it in the application would mean
 * pulling every order of the window across the wire.
 */
async function getSegments(range: StatsRange): Promise<Omit<CustomersStats, "totalCustomers" | "topBuyers">> {
  const [row] = await Order.aggregate<SegmentRow>([
    { $match: { status: { $in: PURCHASE_STATUSES }, ...windowFilter(range, "createdAt") } },
    {
      $group: {
        _id: "$userId",
        orderCount: { $sum: 1 },
        revenueCents: { $sum: { $cond: [IS_REVENUE_EXPR, "$totalCents", 0] } },
        revenueOrders: { $sum: { $cond: [IS_REVENUE_EXPR, 1, 0] } },
      },
    },
    {
      $group: {
        _id: null,
        buyers: { $sum: 1 },
        repeatBuyers: { $sum: { $cond: [{ $gte: ["$orderCount", 2] }, 1, 0] } },
        revenueCents: { $sum: "$revenueCents" },
        revenueOrders: { $sum: "$revenueOrders" },
      },
    },
  ]).exec();

  const revenueOrders = row?.revenueOrders ?? 0;

  return {
    buyers: row?.buyers ?? 0,
    repeatBuyers: row?.repeatBuyers ?? 0,
    averageOrderCents: revenueOrders > 0 ? Math.round((row?.revenueCents ?? 0) / revenueOrders) : 0,
  };
}

/**
 * `totalCustomers` is deliberately **not** windowed, unlike everything else
 * here: "cuántos clientes tengo" doesn't stop being true because the admin
 * picked "últimos 30 días". Same reasoning as `OperationalAlerts`.
 */
export async function getCustomersStats(range: StatsRange): Promise<CustomersStats> {
  const [totalCustomers, segments, topBuyers] = await Promise.all([
    User.countDocuments({ role: "customer" }).exec(),
    getSegments(range),
    getTopBuyers(range),
  ]);

  return { totalCustomers, ...segments, topBuyers };
}
