import type { Request, Response } from "express";
import { paymentWebhookService } from "../services/payment-webhook.service.js";
import { AppError, asyncHandler } from "../utils/index.js";

const SIGNATURE_HEADER = "stripe-signature";

/**
 * The payment gateway's webhook.
 *
 * Mounted **before** `express.json()` (see `app.ts`) so `req.body` is the raw
 * `Buffer` the signature was computed over. Any parsing or sanitising before
 * this point would re-serialise the payload and invalidate the HMAC — which is
 * why this route deliberately sits outside the global middleware chain.
 *
 * It answers `200` for everything it managed to verify, including events it
 * chose to ignore and handlers that failed. That is not laziness: a non-2xx
 * makes the provider redeliver, so returning an error for an event we have
 * already recorded would summon the same event back, forever. Only a payload
 * whose signature does not verify is rejected, and that one is rejected hard.
 */
export const handleStripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  paymentWebhookService.assertWebhookReady();

  if (!Buffer.isBuffer(req.body)) {
    // Reaching here means the raw-body mount was lost — the signature could
    // never verify, so fail loudly rather than silently accepting events.
    throw new AppError("El webhook debe recibirse como cuerpo crudo.", 500);
  }

  await paymentWebhookService.handleEvent(req.body, req.get(SIGNATURE_HEADER));

  res.status(200).json({ received: true });
});
