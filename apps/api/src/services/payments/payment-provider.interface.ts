import type { CaptureMethod, PaymentState } from "@bw-bikes/shared";

/**
 * The narrow, domain-owned surface every payment gateway must implement.
 *
 * Business code depends on **this**, never on a provider SDK. The design spec
 * fixed Stripe as the only gateway for now but explicitly behind an adapter,
 * so that adding Mercado Pago later (the MX market and its interest-free
 * instalments) is a new file implementing this interface rather than a rewrite
 * of the order service.
 *
 * The vocabulary here is deliberately ours: `authorize` versus `capture`,
 * `PaymentState`, cents and `AppError`s in Spanish. Nothing named
 * `payment_intent` or `whsec_` escapes the Stripe adapter.
 */

/** What the order layer asks the gateway to set up. */
export interface CreatePaymentInput {
  /** Integer cents. Computed by the server from catalog prices — never from a request payload. */
  amountCents: number;
  currency: string;
  /**
   * `manual` authorizes without charging, for orders containing a line the
   * shop must confirm with its supplier first.
   */
  captureMethod: CaptureMethod;
  /**
   * Sent to the gateway so a retried network call cannot create a second
   * charge for the same purchase. This is the *provider-side* idempotency key,
   * distinct from the one that de-duplicates our own order creation.
   */
  idempotencyKey: string;
  /** Echoed back on every webhook, so an event can be traced to an order without a lookup table. */
  metadata: Record<string, string>;
}

/**
 * What the gateway reports back. `clientSecret` is the only field that ever
 * reaches the browser, and it is never persisted.
 */
export interface PaymentIntentResult {
  intentId: string;
  clientSecret: string;
  state: PaymentState;
  amountCents: number;
  /** Present once the gateway is holding funds. */
  authorizedAt?: Date;
  capturedAt?: Date;
  /** When an uncaptured authorization lapses on its own. */
  authorizationExpiresAt?: Date;
  lastError?: string;
}

/** A payment as read back from the gateway, without a client secret to hand out. */
export type PaymentSnapshot = Omit<PaymentIntentResult, "clientSecret">;

/** A webhook event, normalized: no provider types leak past this boundary. */
export interface PaymentEventEnvelope {
  id: string;
  type: string;
  /** The gateway payment this event concerns, when it concerns one. */
  intentId?: string;
  /** Metadata as originally sent on the payment — how an event finds its order. */
  metadata: Record<string, string>;
  amountCents?: number;
  refundedAmountCents?: number;
  failureMessage?: string;
  occurredAt: Date;
}

export interface PaymentProvider {
  readonly name: string;
  /** True when credentials exist. False means every call below refuses rather than pretending. */
  readonly isConfigured: boolean;

  createPayment(input: CreatePaymentInput): Promise<PaymentIntentResult>;

  /** Takes previously authorized funds. Only meaningful after a `manual` authorization. */
  capturePayment(intentId: string, idempotencyKey: string): Promise<PaymentSnapshot>;

  /** Drops an authorization without charging anything. */
  cancelPayment(intentId: string, idempotencyKey: string): Promise<PaymentSnapshot>;

  /** Asks the gateway what really happened — the reconciliation job's only tool. */
  retrievePayment(intentId: string): Promise<PaymentSnapshot>;

  refundPayment(intentId: string, idempotencyKey: string): Promise<PaymentSnapshot>;

  /**
   * Verifies a webhook's signature against the **raw** request body and
   * returns the normalized event, or throws. Never a boolean: a caller that
   * can forget to check a boolean is a caller that will.
   */
  verifyWebhook(rawBody: Buffer, signature: string | undefined): PaymentEventEnvelope;
}
