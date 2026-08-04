import rateLimit, { MemoryStore, type Options } from "express-rate-limit";
import { env } from "../config/env.js";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

// Every MemoryStore handed out by createRateLimiter, so tests can wipe all
// of them between cases without recreating the app (and therefore the
// limiters themselves) per test.
const stores: MemoryStore[] = [];

/**
 * Factory for per-action rate limiters — a dedicated, strict limiter per
 * sensitive action rather than one generic limiter for everything. No-op
 * only in `development`, so it never blocks local dev, but stays active in
 * `test` (M2's login-lockout tests assert on it) and, of course,
 * `production`. Admin routes are never wrapped with this: their barrier is
 * auth + role, not throttling.
 *
 * `MemoryStore` is explicit (not the implicit default) so each limiter's
 * store can be tracked and reset between tests via `resetRateLimiters()`;
 * swap for a Redis store if the API ever runs more than one instance.
 */
export function createRateLimiter(config: RateLimitConfig) {
  if (env.nodeEnv === "development") {
    return (_req: unknown, _res: unknown, next: () => void) => next();
  }

  const store = new MemoryStore();
  stores.push(store);

  const options: Partial<Options> = {
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: "fail", message: config.message },
    store,
  };

  return rateLimit(options);
}

/**
 * Test-only helper: clears every limiter's hit counters. Called from
 * tests/setup.ts in `afterEach` so one test's 429s don't bleed into the
 * next — without this, `test` env limiters (active per the rule above)
 * would make every test after the first login-lockout case start already
 * throttled.
 */
export function resetRateLimiters(): void {
  for (const store of stores) void store.resetAll();
}

// Pre-built limiters for the actions already known at this milestone.
// Additional ones (checkout, third-party requests) are added as those
// endpoints land.
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.",
});

/**
 * Separate bucket from `loginRateLimiter`, deliberately — a legitimate
 * admin's first login already spends 1 request on `/login` before it even
 * reaches a TOTP code check (`/2fa/verify`, `/2fa/enroll/complete`,
 * `/2fa/disable`). Sharing one 5-request budget across the whole flow
 * would let normal first-time enrollment lock a real admin out of their
 * own account; each guessable secret (password, TOTP code) gets its own
 * 5/15min ceiling instead.
 */
export const twoFactorRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados intentos. Intenta de nuevo más tarde.",
});

export const publicReadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Demasiadas solicitudes. Intenta de nuevo más tarde.",
});

/**
 * For anonymous, enumeration-sensitive endpoints that trigger an email
 * side effect (register, resend-verification, forgot/reset-password) —
 * the "recurso público con side-effects (email)" row of
 * BACKEND_SECURITY_GUIDELINES.md §7's table (~10/15min), distinct from
 * `publicReadRateLimiter`'s much higher read-only ceiling.
 */
export const authActionRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Demasiadas solicitudes. Intenta de nuevo más tarde.",
});

/**
 * Checkout (`POST /orders`). Strict, because this is the anti card-testing
 * control the e-commerce standard asks for: an endpoint that creates a payment
 * intent per call is exactly what a stolen-card script wants, and each call
 * also holds real inventory. Ten attempts per quarter hour is far more than
 * any genuine buyer needs and far less than a script does.
 */
export const checkoutRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Demasiados intentos de compra. Espera unos minutos e intenta de nuevo.",
});

/**
 * The payment webhook. It is mounted before the global backstop (raw body must
 * precede `express.json`), so without this it would have no limiter at all.
 *
 * Deliberately generous: throttling the payment gateway is paid for in lost
 * events, and its retries are finite. The purpose here is only to stop an
 * unauthenticated flood from reaching signature verification, not to police a
 * legitimate provider.
 */
export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: "Demasiadas solicitudes.",
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
