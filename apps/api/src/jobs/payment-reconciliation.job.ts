import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { orderMaintenanceService } from "../services/order-maintenance.service.js";

/**
 * The backstop for webhooks that never arrived.
 *
 * The payment module treats the gateway's webhook as the only authority on
 * whether an order was paid — which is correct, and which means a lost
 * delivery would otherwise strand a customer who really was charged in
 * `pending_payment` forever, watching their stock hold expire.
 *
 * Webhooks get lost: the provider has an outage, we are mid-deploy, a delivery
 * simply drops. So after a grace period the shop stops waiting to be told and
 * asks the gateway directly, then applies the answer through the very same
 * functions the webhook would have used. A late webhook then finds the work
 * done and changes nothing.
 *
 * Follows the reservation reaper's shape exactly — see that file for why it is
 * a plain interval and not a scheduler dependency.
 */
let timer: NodeJS.Timeout | undefined;

let running = false;

async function sweep(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const reconciled = await orderMaintenanceService.reconcilePendingPayments();
    if (reconciled > 0) {
      logger.info({ reconciled }, "Reconciled payments whose webhook never arrived");
    }
  } catch (error) {
    logger.error({ err: error }, "Payment reconciliation sweep failed");
  } finally {
    running = false;
  }
}

export function startPaymentReconciliation(): void {
  if (timer) return;

  timer = setInterval(() => void sweep(), env.paymentReconciliationIntervalMs);
  timer.unref();

  logger.info({ intervalMs: env.paymentReconciliationIntervalMs }, "Payment reconciliation started");
}

export function stopPaymentReconciliation(): void {
  if (!timer) return;

  clearInterval(timer);
  timer = undefined;
  logger.info("Payment reconciliation stopped");
}
