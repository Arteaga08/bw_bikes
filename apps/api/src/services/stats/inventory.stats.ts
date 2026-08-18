import type { InventoryStats, StatsRange } from "@bw-bikes/shared";
import { InventoryItem, StockReservation } from "../../models/index.js";
import { lowStockMatchExpr } from "../inventory.service.js";
import { settingsService } from "../settings.service.js";

const availableExpr = { $subtract: ["$onHand", "$reserved"] };

/**
 * Current facts, not windowed by date — exported so `alerts.stats.ts` reuses
 * the exact same query instead of a second definition of "out of stock" that
 * could drift from this one.
 */
export async function countOutOfStockSkus(): Promise<number> {
  return InventoryItem.countDocuments({ $expr: { $lte: [availableExpr, 0] } }).exec();
}

async function countLowStockSkus(defaultThreshold: number): Promise<number> {
  return InventoryItem.countDocuments({ $expr: lowStockMatchExpr(defaultThreshold) }).exec();
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
  const { inventory } = await settingsService.get();

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
    countLowStockSkus(inventory.lowStockThresholdUnits),
  ]);

  return {
    range,
    unitsCommitted: committedRows[0]?.units ?? 0,
    outOfStockSkus,
    lowStockSkus,
  };
}
