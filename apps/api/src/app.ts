import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { corsMiddleware } from "./config/cors.js";
import { logger } from "./config/logger.js";
import { errorHandler, globalRateLimiter, mongoSanitize, notFound, sanitizeInput, verifyOrigin } from "./middlewares/index.js";
import { v1Router } from "./routes/index.js";

/**
 * Builds the Express app without opening a port or connecting to the
 * database — this is what makes it testable with supertest (see
 * tests/health.test.ts) and what keeps server.ts a thin bootstrap.
 *
 * Middleware order is exact and load-bearing, per
 * BACKEND_SECURITY_GUIDELINES.md §13:
 *   helmet -> cors(whitelist+credentials) -> express.json({limit:'10kb'}) ->
 *   cookieParser -> mongoSanitize -> sanitizeInput -> verifyOrigin ->
 *   rateLimit(global backstop) -> routers -> notFound -> errorHandler
 *
 * Payment webhooks (added in M5) must mount their raw-body route BEFORE
 * express.json() — there is none yet at this milestone.
 */
export function buildApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(corsMiddleware);
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/v1/health" } }));

  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  app.use(mongoSanitize);
  app.use(sanitizeInput);
  app.use(verifyOrigin);
  app.use(globalRateLimiter);

  app.use("/api/v1", v1Router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
