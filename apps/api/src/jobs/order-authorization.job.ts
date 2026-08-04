import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { orderMaintenanceService } from "../services/order-maintenance.service.js";

/**
 * Keeps the shop ahead of the payment gateway's authorization deadline.
 *
 * Stripe drops an uncaptured card authorization after about a week. An order
 * waiting on a supplier is holding exactly such an authorization — plus, in a
 * mixed cart, real inventory. Letting either lapse unattended is how a shop
 * ends up with stock reserved for a payment that no longer exists.
 *
 * So the sweep does two things, on a clock the owner can tune:
 * warn the admin on day 5, and on day 6.5 cancel the authorization ourselves,
 * release the units and close the order with a reason.
 *
 * Same shape as `reservation-reaper.job.ts`: a plain interval with an
 * anti-overlap guard, started from `server.ts` after the DB is up and stopped
 * first on shutdown — never from `buildApp()`, which must stay free of side
 * effects so supertest doesn't inherit a live timer.
 */
let timer: NodeJS.Timeout | undefined;

let running = false;

async function sweep(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const { alerted, cancelled } = await orderMaintenanceService.sweepAuthorizations();
    if (alerted > 0 || cancelled > 0) {
      logger.info({ alerted, cancelled }, "Swept expiring order authorizations");
    }
  } catch (error) {
    // Never fatal: the same orders are still expiring and the next tick sees them.
    logger.error({ err: error }, "Order authorization sweep failed");
  } finally {
    running = false;
  }
}

export function startOrderAuthorizationSweeper(): void {
  if (timer) return;

  timer = setInterval(() => void sweep(), env.orderAuthSweepIntervalMs);
  timer.unref();

  logger.info({ intervalMs: env.orderAuthSweepIntervalMs }, "Order authorization sweeper started");
}

export function stopOrderAuthorizationSweeper(): void {
  if (!timer) return;

  clearInterval(timer);
  timer = undefined;
  logger.info("Order authorization sweeper stopped");
}
