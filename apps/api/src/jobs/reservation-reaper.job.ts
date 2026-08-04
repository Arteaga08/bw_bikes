import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { inventoryService } from "../services/inventory.service.js";

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
 * ## Why a plain `setInterval` and no scheduler dependency
 *
 * One job, fixed period, no calendar semantics and no queue to coordinate —
 * `node-cron` or BullMQ+Redis would add a dependency (and, for the latter,
 * infrastructure) to express `every N ms`. This closes the design spec's open
 * decision #2 in favour of "cron + Mongo TTL" for phase 1.
 *
 * Running on several API instances at once is safe without a distributed
 * lock: `releaseExpiredReservations` claims each reservation atomically, so
 * two instances sweeping simultaneously can never release the same hold twice.
 */
let timer: NodeJS.Timeout | undefined;

/** Prevents a slow sweep from overlapping itself if a batch outlives the interval. */
let running = false;

async function sweep(): Promise<void> {
  if (running) return;
  running = true;

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
    running = false;
  }
}

/**
 * Started from `server.ts` after the DB connection is up — never from
 * `buildApp()`, which must stay free of side effects so supertest can build
 * the app without leaving a timer behind that keeps vitest alive.
 */
export function startReservationReaper(): void {
  if (timer) return;

  // `unref` so a pending tick never keeps the process alive on shutdown.
  timer = setInterval(() => void sweep(), env.reservationReaperIntervalMs);
  timer.unref();

  logger.info({ intervalMs: env.reservationReaperIntervalMs }, "Stock reservation reaper started");
}

export function stopReservationReaper(): void {
  if (!timer) return;

  clearInterval(timer);
  timer = undefined;
  logger.info("Stock reservation reaper stopped");
}
