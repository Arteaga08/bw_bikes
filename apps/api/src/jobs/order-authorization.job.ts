import { DEFAULT_ORDER_AUTH_SWEEP_INTERVAL_MS } from "../config/settings.defaults.js";
import { logger } from "../config/logger.js";
import { orderMaintenanceService } from "../services/order-maintenance.service.js";
import { settingsService } from "../services/settings.service.js";

/**
 * Keeps the shop ahead of the payment gateway's authorization deadline.
 *
 * Stripe drops an uncaptured card authorization after about a week. An order
 * waiting on a supplier is holding exactly such an authorization — plus, in a
 * mixed cart, real inventory. Letting either lapse unattended is how a shop
 * ends up with stock reserved for a payment that no longer exists.
 *
 * So the sweep does two things, on a clock the owner can tune from the admin
 * panel (`Settings.jobs.orderAuthSweepIntervalMs`): warn the admin on day 5,
 * and on day 6.5 cancel the authorization ourselves, release the units and
 * close the order with a reason.
 *
 * Same self-rescheduling shape as `reservation-reaper.job.ts` — see that
 * file for why a `setTimeout` loop replaced the fixed `setInterval` in M7,
 * and why that removes the need for an anti-overlap `running` flag. Started
 * from `server.ts` after the DB is up and stopped first on shutdown — never
 * from `buildApp()`, which must stay free of side effects so supertest
 * doesn't inherit a live timer.
 */
let timer: NodeJS.Timeout | undefined;
let stopped = true;

async function tick(): Promise<void> {
  try {
    const { alerted, cancelled } = await orderMaintenanceService.sweepAuthorizations();
    if (alerted > 0 || cancelled > 0) {
      logger.info({ alerted, cancelled }, "Swept expiring order authorizations");
    }
  } catch (error) {
    // Never fatal: the same orders are still expiring and the next tick sees them.
    logger.error({ err: error }, "Order authorization sweep failed");
  } finally {
    await scheduleNext();
  }
}

async function scheduleNext(): Promise<void> {
  if (stopped) return;

  const intervalMs = await settingsService
    .get()
    .then((settings) => settings.jobs.orderAuthSweepIntervalMs)
    .catch(() => DEFAULT_ORDER_AUTH_SWEEP_INTERVAL_MS);

  if (stopped) return;

  timer = setTimeout(() => void tick(), intervalMs);
  timer.unref();
}

export function startOrderAuthorizationSweeper(): void {
  if (!stopped) return;
  stopped = false;

  logger.info("Order authorization sweeper started");
  void scheduleNext();
}

export function stopOrderAuthorizationSweeper(): void {
  if (stopped) return;
  stopped = true;

  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  logger.info("Order authorization sweeper stopped");
}
