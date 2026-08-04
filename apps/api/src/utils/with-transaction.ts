import type { ClientSession } from "mongoose";
import mongoose from "mongoose";
import { supportsTransactions } from "../config/db.js";

/**
 * Runs `work` inside a Mongo transaction when the deployment offers one, and
 * plainly when it doesn't (a standalone `mongod` in local development).
 *
 * Used by every operation that has to write to more than one collection at
 * once — inventory's counter plus its reservation document (M4), an order plus
 * its payment event plus its audit entry (M5). Those writes have to land or
 * fail together; a transaction is the only thing that actually guarantees it,
 * and the compensating logic on the fallback path narrows the window without
 * closing it, because a process that dies mid-way never runs its own
 * compensation. Production must therefore be a replica set — `connectDb()`
 * probes the topology at boot and says so loudly when it isn't.
 *
 * `withTransaction` retries the callback on transient errors (a write conflict
 * between two buyers racing for the same row is one), so `work` **must be safe
 * to run more than once**: every step inside it should be an atomic guarded
 * update or a document creation that the aborted attempt rolled back.
 *
 * ## What must never go inside
 *
 * A network call to a third party. An open transaction waiting on Stripe holds
 * locks for the duration of someone else's outage, which is how a replica set
 * falls over. That constraint is why order creation in M5 is a saga with
 * explicit compensation rather than one big transaction — see
 * `order.service.ts`.
 *
 * Lives in `utils/` rather than inside one service because two modules now
 * depend on it; it was extracted from `inventory.service.ts` unchanged.
 */
async function withOptionalTransaction<T>(work: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (!(await supportsTransactions())) {
    return work();
  }

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      // Reassigned on every attempt: a retried transaction must not keep the
      // partial result of the attempt that was rolled back.
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

export { withOptionalTransaction };
