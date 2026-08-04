import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * Opens the Mongo connection. Kept separate from server.ts so app.ts can be
 * imported (e.g. by supertest) without ever touching the database.
 */
export async function connectDb(): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  const connection = await mongoose.connect(env.mongoUri);
  logger.info({ db: connection.connection.name }, "MongoDB connected");

  // Probed at boot rather than lazily, so an operator who deployed against a
  // standalone server sees the warning in the startup logs instead of finding
  // out at the first checkout.
  logger.info({ transactions: await supportsTransactions() }, "MongoDB transaction support detected");

  return connection;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  resetTransactionSupport();
  logger.info("MongoDB disconnected");
}

/**
 * Whether this deployment can run multi-document transactions.
 *
 * Mongo only offers them on a replica set or a sharded cluster — which every
 * managed deployment is (Atlas included), but a bare `mongod` started by hand
 * for local development is not. Code that needs atomicity across two
 * collections asks here and picks its strategy, instead of assuming one and
 * crashing on whichever environment doesn't match.
 *
 * The answer can't change without reconnecting, so it's resolved once and
 * cached — a probe on every call would put an admin round trip in front of
 * every checkout.
 */
let transactionSupport: Promise<boolean> | undefined;

export function supportsTransactions(): Promise<boolean> {
  transactionSupport ??= detectTransactionSupport();
  return transactionSupport;
}

async function detectTransactionSupport(): Promise<boolean> {
  try {
    const admin = mongoose.connection.db?.admin();
    if (!admin) return false;

    // A replica set member reports `setName`; a mongos reports `isdbgrid`.
    const info = (await admin.command({ hello: 1 })) as Record<string, unknown>;
    const supported = typeof info["setName"] === "string" || info["msg"] === "isdbgrid";

    if (!supported) {
      logger.warn(
        "MongoDB is a standalone server: multi-document transactions are unavailable, " +
          "so stock reservations fall back to compensating writes. Use a replica set in production.",
      );
    }
    return supported;
  } catch (error) {
    // Never let a failed probe take down a checkout — assume the safer answer.
    logger.warn({ err: error }, "Could not determine MongoDB transaction support; assuming none");
    return false;
  }
}

/** Clears the cached probe. Exported for tests, which reconnect between files. */
export function resetTransactionSupport(): void {
  transactionSupport = undefined;
}
