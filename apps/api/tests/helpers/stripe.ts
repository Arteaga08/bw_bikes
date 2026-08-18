import Stripe from "stripe";
import type { MockInstance } from "vitest";
import { vi } from "vitest";
import { env } from "../../src/config/env.js";
import { stripeProvider } from "../../src/services/payments/stripe.provider.js";
import type {
  PaymentIntentResult,
  PaymentProvider,
  PaymentSnapshot,
} from "../../src/services/payments/index.js";

/**
 * Test doubles for the payment gateway.
 *
 * ## What is stubbed, and what deliberately is not
 *
 * The four **outbound** calls (create/capture/cancel/retrieve/refund) are
 * replaced with spies: they would otherwise dial Stripe over the network, and
 * a test suite that depends on a third party is a test suite that fails on
 * their bad day, not on ours.
 *
 * `verifyWebhook` is **never** stubbed. Signature verification is the security
 * boundary of the whole payment module — the one thing standing between a
 * random POST and a forged "this order is paid". Stubbing it would mean the
 * suite proves the webhook works only when nobody is attacking it. Instead the
 * tests sign their own payloads with Stripe's own helper and the fixture
 * secret from `vitest.config.ts`, so the real HMAC and the real timestamp
 * tolerance run on every assertion.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface StripeStubs {
  createPayment: MockInstance<PaymentProvider["createPayment"]>;
  capturePayment: MockInstance<PaymentProvider["capturePayment"]>;
  cancelPayment: MockInstance<PaymentProvider["cancelPayment"]>;
  retrievePayment: MockInstance<PaymentProvider["retrievePayment"]>;
  refundPayment: MockInstance<PaymentProvider["refundPayment"]>;
  /** The id of the most recently created payment, ready to sign a webhook for. */
  lastIntentId(): string;
  /** What `retrievePayment` should answer next — the reconciliation job's input. */
  setRetrievedState(state: PaymentSnapshot["state"]): void;
  /**
   * What `retrievePayment` reports as the card on file, next call onward.
   * Mirrors the real adapter's `payment_intent.succeeded` path
   * (`payment-webhook.service.ts`'s `fetchCard`), which reads the card back
   * with a `retrievePayment` call rather than getting it on the event itself.
   */
  setCard(card: { brand: string; last4: string } | undefined): void;
}

/**
 * Replaces the provider's outbound calls with spies. Restored automatically by
 * the global `vi.restoreAllMocks()` in tests/setup.ts.
 *
 * ## The stub mirrors real gateway behaviour in two ways that matter
 *
 * 1. **A fresh payment id per call.** Handing back one fixed id would collide
 *    with the unique index on `payment.intentId` the moment a test creates two
 *    orders — and would quietly hide a real bug in any code that assumes ids
 *    are distinct.
 * 2. **Idempotency keys are honoured.** Calling `createPayment` twice with the
 *    same key returns the *same* payment, exactly as Stripe does. Without
 *    this, the checkout-replay path would appear to work while actually
 *    minting a second charge.
 */
export function stubStripe(options: { intentId?: string } = {}): StripeStubs {
  /** Keyed by provider idempotency key, so a repeat resolves to the original. */
  const byKey = new Map<string, PaymentIntentResult>();
  let lastIntentId = options.intentId ?? "";
  let retrievedState: PaymentSnapshot["state"] = "authorized";
  let retrievedCard: { brand: string; last4: string } | undefined;

  const newIntentId = () => options.intentId ?? `pi_test_${Math.random().toString(16).slice(2, 14)}`;

  const createPayment = vi
    .spyOn(stripeProvider, "createPayment")
    .mockImplementation(async (input): Promise<PaymentIntentResult> => {
      const replay = byKey.get(input.idempotencyKey);
      if (replay) {
        lastIntentId = replay.intentId;
        return replay;
      }

      const intentId = newIntentId();
      const result: PaymentIntentResult = {
        intentId,
        clientSecret: `${intentId}_secret_test`,
        // Creation only *starts* a payment. Nothing is authorized or captured
        // until the customer completes it and the webhook says so — the real
        // gateway never returns a paid state here either.
        state: "pending",
        amountCents: input.amountCents,
      };

      byKey.set(input.idempotencyKey, result);
      lastIntentId = intentId;
      return result;
    });

  const capturePayment = vi
    .spyOn(stripeProvider, "capturePayment")
    .mockImplementation(
      async (intentId): Promise<PaymentSnapshot> => ({
        intentId,
        state: "captured",
        amountCents: 0,
        capturedAt: new Date(),
        ...(retrievedCard ? { card: retrievedCard } : {}),
      }),
    );

  const cancelPayment = vi
    .spyOn(stripeProvider, "cancelPayment")
    .mockImplementation(async (intentId): Promise<PaymentSnapshot> => ({ intentId, state: "canceled", amountCents: 0 }));

  const retrievePayment = vi
    .spyOn(stripeProvider, "retrievePayment")
    .mockImplementation(async (intentId): Promise<PaymentSnapshot> => {
      const authorizedAt = new Date();
      return {
        intentId,
        state: retrievedState,
        amountCents: 0,
        ...(retrievedState === "authorized"
          ? {
              authorizedAt,
              authorizationExpiresAt: new Date(authorizedAt.getTime() + 7 * MS_PER_DAY),
            }
          : {}),
        ...(retrievedState === "captured" ? { capturedAt: new Date() } : {}),
        ...(retrievedCard ? { card: retrievedCard } : {}),
      };
    });

  const refundPayment = vi
    .spyOn(stripeProvider, "refundPayment")
    .mockImplementation(async (intentId): Promise<PaymentSnapshot> => ({ intentId, state: "refunded", amountCents: 0 }));

  return {
    createPayment,
    capturePayment,
    cancelPayment,
    retrievePayment,
    refundPayment,
    lastIntentId: () => lastIntentId,
    setRetrievedState: (state) => {
      retrievedState = state;
    },
    setCard: (card) => {
      retrievedCard = card;
    },
  };
}

/**
 * Builds a Stripe event body the way Stripe would, and signs it with the
 * fixture webhook secret using **Stripe's own signing helper** — so the
 * verification path under test is byte-for-byte the production one.
 *
 * `timestamp` is exposed so a test can produce a stale signature and prove the
 * replay window is actually enforced.
 */
export function signStripeEvent(options: {
  id?: string;
  type: string;
  object: Record<string, unknown>;
  timestamp?: number;
  secret?: string;
}): { body: string; signature: string; eventId: string } {
  const eventId = options.id ?? `evt_test_${Math.random().toString(16).slice(2, 12)}`;

  const body = JSON.stringify({
    id: eventId,
    object: "event",
    api_version: Stripe.API_VERSION,
    created: Math.floor(Date.now() / 1000),
    type: options.type,
    data: { object: options.object },
  });

  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: options.secret ?? env.stripeWebhookSecret,
    ...(options.timestamp !== undefined ? { timestamp: options.timestamp } : {}),
  });

  return { body, signature, eventId };
}

/** A PaymentIntent object as it appears inside an event payload. */
export function paymentIntentObject(overrides: {
  id: string;
  status?: string;
  amount?: number;
  orderId?: string;
  lastError?: string;
}): Record<string, unknown> {
  return {
    id: overrides.id,
    object: "payment_intent",
    amount: overrides.amount ?? 0,
    currency: "mxn",
    status: overrides.status ?? "succeeded",
    metadata: overrides.orderId ? { orderId: overrides.orderId } : {},
    ...(overrides.lastError ? { last_payment_error: { message: overrides.lastError } } : {}),
  };
}

/** A Charge object, as `charge.refunded` delivers it. */
export function chargeObject(overrides: {
  intentId: string;
  amountRefunded?: number;
  orderId?: string;
}): Record<string, unknown> {
  return {
    id: `ch_test_${Math.random().toString(16).slice(2, 10)}`,
    object: "charge",
    payment_intent: overrides.intentId,
    amount_refunded: overrides.amountRefunded ?? 0,
    metadata: overrides.orderId ? { orderId: overrides.orderId } : {},
  };
}
