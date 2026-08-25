import { MongoMemoryReplSet } from "mongodb-memory-server";
import { logger } from "../config/logger.js";

/**
 * Standalone, long-running Mongo for the Playwright suite (`apps/e2e`) — the
 * first entry in `playwright.config.ts`'s `webServer` array. `apps/api` then
 * boots against this on a fixed port, never against a developer's real Atlas
 * cluster.
 *
 * Single-node replica set, same shape as `apps/api/tests/setup.ts`: Mongo
 * only offers multi-document transactions on a replica set, and
 * `inventory.service.ts` uses one. A standalone here would silently exercise
 * a different code path than production runs.
 *
 * Fixed port (not a random one, unlike `tests/setup.ts`'s per-process
 * instance): `apps/api`'s own `webServer` entry needs a `MONGODB_URI` it can
 * know ahead of time, since Playwright's `webServer` commands are static
 * strings evaluated before this process has started.
 */
const PORT = 27117;
const DB_NAME = "bw_bikes_e2e";

export const E2E_MONGO_URI = `mongodb://127.0.0.1:${PORT}/${DB_NAME}`;

async function run(): Promise<void> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ port: PORT }],
  });

  logger.info(`[e2e-mongo] Ready at ${E2E_MONGO_URI}`);

  const shutdown = async (): Promise<void> => {
    logger.info("[e2e-mongo] Shutting down...");
    await replSet.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

run().catch((error: unknown) => {
  logger.error({ err: error }, "[e2e-mongo] Failed to start.");
  process.exit(1);
});
