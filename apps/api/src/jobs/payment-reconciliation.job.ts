import { DEFAULT_PAYMENT_RECONCILIATION_INTERVAL_MS } from "../config/settings.defaults.js";
import { logger } from "../config/logger.js";
import { orderMaintenanceService } from "../services/order-maintenance.service.js";
import { settingsService } from "../services/settings.service.js";

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
 * Follows the reservation reaper's self-rescheduling shape exactly — see
 * that file for why it is a `setTimeout` loop reading `Settings` fresh on
 * every tick, and not a fixed `setInterval` or a scheduler dependency.
 */
let timer: NodeJS.Timeout | undefined;
let stopped = true;

async function tick(): Promise<void> {
  try {
    const reconciled = await orderMaintenanceService.reconcilePendingPayments();
    if (reconciled > 0) {
      logger.info({ reconciled }, "Reconciled payments whose webhook never arrived");
    }
  } catch (error) {
    logger.error({ err: error }, "Payment reconciliation sweep failed");
  } finally {
    await scheduleNext();
  }
}

async function scheduleNext(): Promise<void> {
  if (stopped) return;

  const intervalMs = await settingsService
    .get()
    .then((settings) => settings.jobs.paymentReconciliationIntervalMs)
    .catch(() => DEFAULT_PAYMENT_RECONCILIATION_INTERVAL_MS);

  if (stopped) return;

  timer = setTimeout(() => void tick(), intervalMs);
  timer.unref();
}

export function startPaymentReconciliation(): void {
  if (!stopped) return;
  stopped = false;

  logger.info("Payment reconciliation started");
  void scheduleNext();
}

export function stopPaymentReconciliation(): void {
  if (stopped) return;
  stopped = true;

  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  logger.info("Payment reconciliation stopped");
}
