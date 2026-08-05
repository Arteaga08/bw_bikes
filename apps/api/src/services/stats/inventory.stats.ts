import type { InventoryStats, StatsRange } from "@bw-bikes/shared";
import { InventoryItem, StockReservation } from "../../models/index.js";

/**
 * Not a `Settings` value — M7's migration list (the design spec's thirteen
 * env-backed thresholds) never included a merchandising "low stock" line.
 * This is a fixed operational cutoff for the panel's own alerting, kept
 * local to this module rather than promoted to a section nobody asked for.
 */
const LOW_STOCK_THRESHOLD_UNITS = 5;

const availableExpr = { $subtract: ["$onHand", "$reserved"] };

/**
 * Current facts, not windowed by date — exported so `alerts.stats.ts` reuses
 * the exact same query instead of a second definition of "out of stock" that
 * could drift from this one.
 */
export async function countOutOfStockSkus(): Promise<number> {
  return InventoryItem.countDocuments({ $expr: { $lte: [availableExpr, 0] } }).exec();
}

async function countLowStockSkus(): Promise<number> {
  return InventoryItem.countDocuments({
    $expr: {
      $and: [{ $gt: [availableExpr, 0] }, { $lte: [availableExpr, LOW_STOCK_THRESHOLD_UNITS] }],
    },
  }).exec();
}

interface CommittedUnitsRow {
  units: number;
}

/**
 * `unitsCommitted` is windowed (units that actually left the warehouse via
 * `StockReservation.committedAt`, inside `range`); `outOfStockSkus` and
 * `lowStockSkus` are today's snapshot regardless of the window — a stockout
 * doesn't become less true because the admin filtered to last month.
 */
export async function getInventoryStats(range: StatsRange): Promise<InventoryStats> {
  const [committedRows, outOfStockSkus, lowStockSkus] = await Promise.all([
    StockReservation.aggregate<CommittedUnitsRow>([
      {
        $match: {
          status: "committed",
          committedAt: { $gte: new Date(range.from), $lt: new Date(range.to) },
        },
      },
      { $group: { _id: null, units: { $sum: "$qty" } } },
    ]).exec(),
    countOutOfStockSkus(),
    countLowStockSkus(),
  ]);

  return {
    range,
    unitsCommitted: committedRows[0]?.units ?? 0,
    outOfStockSkus,
    lowStockSkus,
  };
}
