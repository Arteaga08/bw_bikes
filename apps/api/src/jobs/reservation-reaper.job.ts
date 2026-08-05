import { DEFAULT_REAPER_INTERVAL_MS } from "../config/settings.defaults.js";
import { logger } from "../config/logger.js";
import { inventoryService } from "../services/inventory.service.js";
import { settingsService } from "../services/settings.service.js";

/**
 * Periodic sweep that gives back stock held by reservations whose deadline
 * passed and that the normal flow never cleaned up — a crashed checkout, a
 * payment webhook that never arrived, a browser closed mid-payment.
 *
 * ## Why a timer and not a TTL index
 *
 * Mongo's TTL would delete the expired document, and with it the only record
 * of how many units to give back — `reserved` would stay inflated forever.
 * The TTL on `StockReservation.purgeAt` is record retention; *this* is what
 * releases stock. See the model's comment for the full reasoning.
 *
 * ## Why a self-rescheduling `setTimeout` and no scheduler dependency
 *
 * One job, a period the owner can tune from the admin panel, no calendar
 * semantics and no queue to coordinate — `node-cron` or BullMQ+Redis would
 * add a dependency (and, for the latter, infrastructure) to express "every N
 * ms, where N can change without a redeploy". This closes the design spec's
 * open decision #2 in favour of "cron + Mongo TTL" for phase 1.
 *
 * `setInterval` at a fixed period (M4) became a `setTimeout` that reschedules
 * itself at the end of each tick (M7), reading the interval from `Settings`
 * fresh every time — a change the admin makes takes effect on the *next*
 * tick, not after a restart. This also drops the old `running` guard: since
 * the next tick is only ever scheduled after the current one finishes, a slow
 * sweep can no longer overlap itself by construction.
 *
 * Running on several API instances at once is still safe without a
 * distributed lock: `releaseExpiredReservations` claims each reservation
 * atomically, so two instances sweeping simultaneously can never release the
 * same hold twice.
 */
let timer: NodeJS.Timeout | undefined;
let stopped = true;

async function tick(): Promise<void> {
  try {
    const released = await inventoryService.releaseExpiredReservations();
    if (released > 0) {
      logger.info({ released }, "Released expired stock reservations");
    }
  } catch (error) {
    // A failed sweep is never fatal: the same reservations are still expired
    // and the next tick picks them up.
    logger.error({ err: error }, "Stock reservation sweep failed");
  } finally {
    await scheduleNext();
  }
}

async function scheduleNext(): Promise<void> {
  if (stopped) return;

  // A failed read falls back to the default interval rather than leaving the
  // job unscheduled — a job that stops rescheduling itself because one
  // `Settings` read failed is a job that silently died.
  const intervalMs = await settingsService
    .get()
    .then((settings) => settings.jobs.reservationReaperIntervalMs)
    .catch(() => DEFAULT_REAPER_INTERVAL_MS);

  if (stopped) return;

  timer = setTimeout(() => void tick(), intervalMs);
  timer.unref();
}

/**
 * Started from `server.ts` after the DB connection is up — never from
 * `buildApp()`, which must stay free of side effects so supertest can build
 * the app without leaving a timer behind that keeps vitest alive.
 */
export function startReservationReaper(): void {
  if (!stopped) return;
  stopped = false;

  logger.info("Stock reservation reaper started");
  void scheduleNext();
}

export function stopReservationReaper(): void {
  if (stopped) return;
  stopped = true;

  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  logger.info("Stock reservation reaper stopped");
}
