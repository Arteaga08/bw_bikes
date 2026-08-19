import { logger } from "../config/logger.js";
import type { IInventoryItem } from "../models/index.js";
import { InventoryItem } from "../models/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { createMailer } from "./mailer/index.js";
import { createNotifier } from "./notifier/index.js";
import { settingsService } from "./settings.service.js";

const MODULE_NAME = "inventory";

/** Bounded sweeps, same reasoning as `order-maintenance.service.ts`'s `SWEEP_BATCH_SIZE`. */
const SWEEP_BATCH_SIZE = 200;

/**
 * The low-stock alert's own background duty, mirroring
 * `order-maintenance.service.ts`'s shape: a plain function taking an
 * explicit clock, so its test can drive it directly instead of waiting on a
 * timer.
 *
 * Unlike `lowStockMatchExpr` (`inventory.service.ts`), this **includes**
 * zero stock — that function deliberately excludes it because the admin
 * panel shows "out of stock" as its own bucket, but for "does this SKU need
 * reordering" both cases are the same answer: yes.
 */
function lowOrOutOfStockExpr(defaultThreshold: number): Record<string, unknown> {
  const availableExpr = { $subtract: ["$onHand", "$reserved"] };
  const thresholdExpr = { $ifNull: ["$lowStockThreshold", defaultThreshold] };
  return { $lte: [availableExpr, thresholdExpr] };
}

function aboveThresholdExpr(defaultThreshold: number): Record<string, unknown> {
  const availableExpr = { $subtract: ["$onHand", "$reserved"] };
  const thresholdExpr = { $ifNull: ["$lowStockThreshold", defaultThreshold] };
  return { $gt: [availableExpr, thresholdExpr] };
}

function effectiveThreshold(item: IInventoryItem, defaultThreshold: number): number {
  return item.lowStockThreshold ?? defaultThreshold;
}

/**
 * Alerts on every SKU crossing at or below its effective threshold for the
 * first time. Sealed with `lowStockAlertedAt` so the alert fires exactly
 * once per crossing, no matter how often the sweep runs — same mutex
 * `order-maintenance.service.ts` uses on `adminAlertedAt`.
 */
async function alertLowStockItems(defaultThreshold: number, now: Date): Promise<number> {
  const due = await InventoryItem.find({
    lowStockAlertedAt: { $exists: false },
    $expr: lowOrOutOfStockExpr(defaultThreshold),
  })
    .limit(SWEEP_BATCH_SIZE)
    .exec();

  let alerted = 0;

  for (const item of due) {
    const claimed = await InventoryItem.findOneAndUpdate(
      { _id: item._id, lowStockAlertedAt: { $exists: false } },
      { $set: { lowStockAlertedAt: now } },
      { new: true },
    ).exec();

    if (!claimed) continue;

    alerted++;

    const available = claimed.onHand - claimed.reserved;
    const threshold = effectiveThreshold(claimed, defaultThreshold);
    const title = `Stock bajo — SKU ${claimed.sku}`;
    const body = `Quedan ${available} unidades (umbral: ${threshold}). Revisa el inventario y reabastece si es necesario.`;

    // Best-effort on both channels, same reasoning as
    // `order-maintenance.service.ts`'s sweep: a flaky Telegram or Resend
    // call must never block sealing `lowStockAlertedAt`, or a down provider
    // would make this fire on every tick instead of exactly once.
    await createNotifier()
      .notifyAdmin({
        kind: "inventory.low_stock",
        title,
        body,
        meta: { inventoryItemId: String(claimed._id), sku: claimed.sku, available, threshold },
      })
      .catch((error: unknown) => {
        logger.error({ err: error, inventoryItemId: String(claimed._id) }, "Failed to notify the admin of low stock");
      });

    await createMailer()
      .sendAdminAlertEmail({ subject: title, title, bodyParagraphs: [body] })
      .catch((error: unknown) => {
        logger.error({ err: error, inventoryItemId: String(claimed._id) }, "Failed to send the low-stock admin alert email");
      });

    await recordAuditLog({
      actorType: "system",
      action: "inventory.low_stock",
      module: MODULE_NAME,
      targetId: String(claimed._id),
      after: { sku: claimed.sku, available, threshold },
    });
  }

  return alerted;
}

/**
 * Stock is a level, not a one-way state machine — a SKU can be restocked
 * above its threshold and later deplete again. Clearing the flag once it
 * recovers is what lets the next depletion alert again instead of staying
 * silent for the rest of this row's life.
 */
async function clearRecoveredAlerts(defaultThreshold: number): Promise<number> {
  const recovered = await InventoryItem.find({
    lowStockAlertedAt: { $exists: true },
    $expr: aboveThresholdExpr(defaultThreshold),
  })
    .limit(SWEEP_BATCH_SIZE)
    .exec();

  let cleared = 0;

  for (const item of recovered) {
    const result = await InventoryItem.updateOne(
      { _id: item._id, lowStockAlertedAt: { $exists: true } },
      { $unset: { lowStockAlertedAt: "" } },
    ).exec();

    if (result.modifiedCount > 0) cleared++;
  }

  return cleared;
}

async function sweepLowStock(now: Date = new Date()): Promise<{ alerted: number; cleared: number }> {
  const { inventory } = await settingsService.get();
  const alerted = await alertLowStockItems(inventory.lowStockThresholdUnits, now);
  const cleared = await clearRecoveredAlerts(inventory.lowStockThresholdUnits);
  return { alerted, cleared };
}

export const inventoryMaintenanceService = {
  sweepLowStock,
  alertLowStockItems,
  clearRecoveredAlerts,
};
