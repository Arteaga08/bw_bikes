import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { corsMiddleware } from "./config/cors.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler, globalRateLimiter, mongoSanitize, notFound, sanitizeInput, verifyOrigin } from "./middlewares/index.js";
import { v1Router, webhookRouter } from "./routes/index.js";

/**
 * Builds the Express app without opening a port or connecting to the
 * database — this is what makes it testable with supertest (see
 * tests/health.test.ts) and what keeps server.ts a thin bootstrap.
 *
 * Middleware order is exact and load-bearing, per
 * BACKEND_SECURITY_GUIDELINES.md §13:
 *   helmet -> cors(whitelist+credentials) -> [payment webhooks, raw body] ->
 *   express.json({limit:'10kb'}) -> cookieParser -> mongoSanitize ->
 *   sanitizeInput -> verifyOrigin -> rateLimit(global backstop) -> routers ->
 *   notFound -> errorHandler
 *
 * ## Why the webhook is mounted where it is (M5)
 *
 * A payment webhook is authenticated by an HMAC over the **exact bytes** the
 * gateway sent. `express.json()` would replace those bytes with a parsed
 * object, and `sanitizeInput` would rewrite the strings inside it — either one
 * makes every signature fail. So the webhook router is mounted before both,
 * with `express.raw`, and consequently sits outside the rest of the chain:
 *
 * - No `cookieParser`, `mongoSanitize` or `sanitizeInput`. Correct: the
 *   payload is verified cryptographically and never used to build a query.
 * - No `verifyOrigin`. It would pass anyway (that middleware lets through
 *   requests with neither Origin nor Referer, which is what a server-to-server
 *   call is), but the point is that CSRF is meaningless here — there is no
 *   ambient credential to ride on.
 * - No `globalRateLimiter`, so the route carries its own `webhookRateLimiter`.
 * - `errorHandler` still applies: it is registered last, after every router.
 */
export function buildApp(): Express {
  const app = express();

  // Behind a reverse proxy (Render/Railway) every request otherwise arrives
  // from the proxy's own IP, so a per-IP limiter (e.g. login 5/15min) would
  // throttle all users globally instead of individually. Only trusted in
  // production, where that proxy is real; trusting it in dev/test would let
  // a spoofed X-Forwarded-For header bypass rate limiting.
  if (env.isProduction) {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(corsMiddleware);
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/v1/health" } }));

  // Raw body, and therefore before the JSON parser. See the header comment.
  app.use("/api/v1/webhooks", webhookRouter);

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
