import { DEFAULT_LOW_STOCK_ALERT_INTERVAL_MS } from "../config/settings.defaults.js";
import { logger } from "../config/logger.js";
import { inventoryMaintenanceService } from "../services/inventory-maintenance.service.js";
import { settingsService } from "../services/settings.service.js";

/**
 * Keeps the owner ahead of running out of stock.
 *
 * A SKU crossing at or below its effective low-stock threshold — its own
 * override, or the store-wide `Settings.inventory.lowStockThresholdUnits` —
 * is worth a prompt nudge to reorder, on both Telegram and email so it isn't
 * missed. Ticks on a clock the owner can tune from the admin panel
 * (`Settings.jobs.lowStockAlertIntervalMs`).
 *
 * Same self-rescheduling `setTimeout` shape as `order-authorization.job.ts`
 * — see that file for why a fixed `setInterval` was replaced in M7, and why
 * that removes the need for an anti-overlap `running` flag. Started from
 * `server.ts` after the DB is up and stopped first on shutdown — never from
 * `buildApp()`, which must stay free of side effects so supertest doesn't
 * inherit a live timer.
 */
let timer: NodeJS.Timeout | undefined;
let stopped = true;

async function tick(): Promise<void> {
  try {
    const { alerted, cleared } = await inventoryMaintenanceService.sweepLowStock();
    if (alerted > 0 || cleared > 0) {
      logger.info({ alerted, cleared }, "Swept low-stock inventory items");
    }
  } catch (error) {
    // Never fatal: the same rows are still low and the next tick sees them.
    logger.error({ err: error }, "Low-stock sweep failed");
  } finally {
    await scheduleNext();
  }
}

async function scheduleNext(): Promise<void> {
  if (stopped) return;

  const intervalMs = await settingsService
    .get()
    .then((settings) => settings.jobs.lowStockAlertIntervalMs)
    .catch(() => DEFAULT_LOW_STOCK_ALERT_INTERVAL_MS);

  if (stopped) return;

  timer = setTimeout(() => void tick(), intervalMs);
  timer.unref();
}

export function startLowStockAlertSweeper(): void {
  if (!stopped) return;
  stopped = false;

  logger.info("Low-stock alert sweeper started");
  void scheduleNext();
}

export function stopLowStockAlertSweeper(): void {
  if (stopped) return;
  stopped = true;

  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  logger.info("Low-stock alert sweeper stopped");
}
