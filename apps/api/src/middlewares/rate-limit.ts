import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../config/env.js";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

/**
 * Factory for per-action rate limiters — a dedicated, strict limiter per
 * sensitive action rather than one generic limiter for everything. No-op
 * outside production so it never blocks local dev or tests. Admin routes are
 * never wrapped with this: their barrier is auth + role, not throttling.
 *
 * `MemoryStore` (the default) is explicit here so tests can spin up a fresh
 * app without cross-test state; swap for a Redis store if the API ever runs
 * more than one instance.
 */
export function createRateLimiter(config: RateLimitConfig) {
  if (!env.isProduction) {
    return (_req: unknown, _res: unknown, next: () => void) => next();
  }

  const options: Partial<Options> = {
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: "fail", message: config.message },
  };

  return rateLimit(options);
}

// Pre-built limiters for the actions already known at this milestone.
// Additional ones (checkout, third-party requests) are added as those
// endpoints land.
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.",
});

export const publicReadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Demasiadas solicitudes. Intenta de nuevo más tarde.",
});

/**
 * Global backstop mounted once in the middleware chain (app.ts), after
 * verifyOrigin and before the routers. Generous on purpose — it's a safety
 * net against abusive traffic in general, not the primary control for any
 * specific sensitive action (those get their own dedicated limiter above,
 * mounted on their own route).
 */
export const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Demasiadas solicitudes desde esta IP. Intenta de nuevo más tarde.",
});
