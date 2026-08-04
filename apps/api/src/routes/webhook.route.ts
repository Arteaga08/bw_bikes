import express, { Router } from "express";
import { handleStripeWebhook } from "../controllers/webhook.controller.js";
import { webhookRateLimiter } from "../middlewares/index.js";

/**
 * Payment webhooks. Mounted in `app.ts` **before** `express.json()`, which is
 * the whole reason this router exists separately from `v1Router`.
 *
 * `express.raw` keeps the body as the exact bytes the gateway signed. Running
 * it through the JSON parser — or through `sanitizeInput`, which rewrites
 * strings — would change those bytes and make every signature fail. So this
 * route deliberately sits outside the global middleware chain, and pays for it
 * with its own rate limiter.
 *
 * There is no `protect` here and there cannot be: the caller is Stripe, not a
 * user. **The signature is the authentication**, verified in the service
 * before a single byte of the payload is trusted.
 */
const router = Router();

router.post(
  "/stripe",
  webhookRateLimiter,
  // Only this content type; anything else arrives as an empty body and is
  // rejected by the controller's Buffer check rather than silently accepted.
  express.raw({ type: "application/json", limit: "1mb" }),
  handleStripeWebhook,
);

export { router as webhookRouter };
