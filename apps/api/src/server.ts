import type { Server } from "node:http";
import { buildApp } from "./app.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import {
  startLowStockAlertSweeper,
  startOrderAuthorizationSweeper,
  startPaymentReconciliation,
  startReservationReaper,
  stopLowStockAlertSweeper,
  stopOrderAuthorizationSweeper,
  stopPaymentReconciliation,
  stopReservationReaper,
} from "./jobs/index.js";

async function main(): Promise<void> {
  await connectDb();

  // Background jobs live here and not in `buildApp()`: the app must stay free
  // of side effects so tests can build it without leaving timers running.
  startReservationReaper();
  startOrderAuthorizationSweeper();
  startPaymentReconciliation();
  startLowStockAlertSweeper();

  const app = buildApp();
  const server: Server = app.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, "Black and White Bikes API listening");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down gracefully");
    stopReservationReaper();
    stopOrderAuthorizationSweeper();
    stopPaymentReconciliation();
    stopLowStockAlertSweeper();

    server.close(async (err) => {
      if (err) {
        logger.error({ err }, "Error while closing HTTP server");
      }
      await disconnectDb();
      process.exit(err ? 1 : 0);
    });

    // Safety net: force-exit if close() hangs (open sockets, stuck handlers).
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
