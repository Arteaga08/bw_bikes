import type { PaymentState } from "@bw-bikes/shared";
import Stripe from "stripe";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/index.js";
import type {
  CreatePaymentInput,
  PaymentEventEnvelope,
  PaymentIntentResult,
  PaymentProvider,
  PaymentSnapshot,
} from "./payment-provider.interface.js";

/**
 * The only module in the codebase that imports the Stripe SDK.
 *
 * Everything Stripe-specific stops here: its status vocabulary, its
 * `payment_intent` naming, its signature scheme, and the 7-day authorization
 * lifetime below. Business code sees `PaymentProvider` and nothing else.
 */

/**
 * How long Stripe keeps an uncaptured card authorization before dropping it.
 * Not exposed as a field on the PaymentIntent, so it is provider knowledge and
 * it lives here rather than being guessed at by the order service. The expiry
 * job acts a day and a half before this (`ORDER_AUTH_CANCEL_HOURS`).
 */
const AUTHORIZATION_LIFETIME_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Card only, deliberately.
 *
 * Manual capture — the mechanism this whole milestone exists for — is a
 * card-network feature. Redirect and voucher methods (OXXO, bank transfer)
 * cannot hold funds for later capture, so offering them would produce orders
 * that silently cannot follow the supplier-confirmation flow. The client also
 * already accepted that made-to-order bikes can't offer interest-free
 * instalments for the same reason.
 */
const PAYMENT_METHOD_TYPES = ["card"];

let client: Stripe | undefined;

/**
 * Built lazily so importing this module never throws when Stripe is
 * unconfigured — outside production that is a supported state, and the API
 * must still boot to serve the catalog.
 */
function stripeClient(): Stripe {
  if (!env.isStripeConfigured) {
    throw notConfigured();
  }
  client ??= new Stripe(env.stripeSecretKey, {
    // Pinned to the version this SDK was built against, so a server-side API
    // upgrade at Stripe can never silently change response shapes under us.
    apiVersion: Stripe.API_VERSION,
    typescript: true,
  });
  return client;
}

function notConfigured(): AppError {
  return new AppError(
    "Los pagos no están configurados en este entorno. Contacta al administrador.",
    503,
  );
}

/**
 * Maps Stripe's seven statuses onto the six this domain recognises.
 *
 * `requires_capture` is the one that matters: funds held, nothing charged —
 * the state an on-request order lives in while the owner talks to the
 * supplier. Everything still in flight collapses to `pending`; a payment that
 * came back with an error is `failed` so the order can be closed rather than
 * left hanging.
 */
function mapState(intent: Stripe.PaymentIntent): PaymentState {
  switch (intent.status) {
    case "succeeded":
      return "captured";
    case "requires_capture":
      return "authorized";
    case "canceled":
      return "canceled";
    case "requires_payment_method":
      return intent.last_payment_error ? "failed" : "pending";
    default:
      return "pending";
  }
}

/**
 * Reads brand/last4 off the intent's charge, when the caller asked for it
 * expanded (`expand: ["latest_charge"]` — a webhook payload never carries
 * this, only the direct capture/retrieve calls do). `undefined` on any of
 * "not expanded" / "no charge yet" / "not a card" — all three are the normal
 * shape of an intent that hasn't been captured yet, not an error.
 */
function extractCard(intent: Stripe.PaymentIntent): { brand: string; last4: string } | undefined {
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string") return undefined;
  const card = charge.payment_method_details?.card;
  if (!card?.brand || !card.last4) return undefined;
  return { brand: card.brand, last4: card.last4 };
}

/** Stripe reports amounts in the smallest currency unit, which is what we store too. */
function toSnapshot(intent: Stripe.PaymentIntent): PaymentSnapshot {
  const state = mapState(intent);
  const authorizedAt = intent.status === "requires_capture" ? new Date(intent.created * 1000) : undefined;
  const card = extractCard(intent);

  return {
    intentId: intent.id,
    state,
    amountCents: intent.amount,
    ...(authorizedAt !== undefined ? { authorizedAt } : {}),
    ...(intent.status === "succeeded" ? { capturedAt: new Date() } : {}),
    ...(authorizedAt !== undefined
      ? { authorizationExpiresAt: new Date(authorizedAt.getTime() + AUTHORIZATION_LIFETIME_DAYS * MS_PER_DAY) }
      : {}),
    ...(intent.last_payment_error?.message !== undefined
      ? { lastError: intent.last_payment_error.message }
      : {}),
    ...(card ? { card } : {}),
  };
}

/**
 * Turns any Stripe SDK failure into an operational `AppError`.
 *
 * Card declines and invalid requests are business outcomes, not server bugs,
 * and must not surface as a 500 — but the message shown to the customer is
 * Stripe's only when Stripe intended it to be seen (`StripeCardError`).
 * Anything else gets a generic message, because a raw gateway error can carry
 * account internals.
 */
function toAppError(error: unknown, fallback: string): AppError {
  if (error instanceof Stripe.errors.StripeCardError) {
    return new AppError(error.message, 402);
  }
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    return new AppError(fallback, 409);
  }
  return new AppError(fallback, 502);
}

/**
 * Pulls the payment id out of any event shape we care about. Payment-intent
 * events carry it as the object's own id; charge and dispute events reference
 * it in a field that may be expanded into a full object.
 */
function extractIntentId(object: Record<string, unknown>, type: string): string | undefined {
  if (type.startsWith("payment_intent.")) {
    return typeof object["id"] === "string" ? object["id"] : undefined;
  }

  const reference = object["payment_intent"];
  if (typeof reference === "string") return reference;
  if (reference && typeof reference === "object" && typeof (reference as { id?: unknown }).id === "string") {
    return (reference as { id: string }).id;
  }
  return undefined;
}

function extractMetadata(object: Record<string, unknown>): Record<string, string> {
  const metadata = object["metadata"];
  if (!metadata || typeof metadata !== "object") return {};

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

/** Stripe's own shape for the address Radar scores against. `undefined` when the order has none yet. */
function toStripeShipping(address: CreatePaymentInput["shippingAddress"]): Stripe.PaymentIntentCreateParams.Shipping | undefined {
  if (!address) return undefined;
  return {
    name: address.recipientName,
    phone: address.phone,
    address: {
      line1: address.street,
      ...(address.interiorNumber !== undefined ? { line2: address.interiorNumber } : {}),
      city: address.city,
      state: address.state,
      postal_code: address.postalCode,
      country: address.country,
    },
  };
}

async function createPayment(input: CreatePaymentInput): Promise<PaymentIntentResult> {
  try {
    const shipping = toStripeShipping(input.shippingAddress);
    const intent = await stripeClient().paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        capture_method: input.captureMethod,
        payment_method_types: PAYMENT_METHOD_TYPES,
        metadata: input.metadata,
        // The control that shifts chargeback liability to the card issuer.
        // `"automatic"` (Stripe's own default) lets its risk engine decide;
        // `"any"` forces a challenge on every card payment. Read from
        // Settings, never a literal here — see CreatePaymentInput's doc.
        payment_method_options: {
          card: { request_three_d_secure: input.requestThreeDSecure },
        },
        ...(shipping ? { shipping } : {}),
      },
      // Stripe's own idempotency: a retried network call resolves to the same
      // PaymentIntent instead of creating a second one for the same purchase.
      { idempotencyKey: input.idempotencyKey },
    );

    if (!intent.client_secret) {
      throw new AppError("El proveedor de pagos no devolvió un secreto de cliente.", 502);
    }

    return { ...toSnapshot(intent), clientSecret: intent.client_secret };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw toAppError(error, "No se pudo iniciar el pago. Intenta de nuevo.");
  }
}

async function capturePayment(intentId: string, idempotencyKey: string): Promise<PaymentSnapshot> {
  try {
    // No `amount_to_capture`: the shop captures exactly what it authorized.
    // Partial capture would break the invariant that `order.totalCents` is what
    // the customer was charged. `expand: ["latest_charge"]` so `toSnapshot`
    // can read the card brand/last4 off the charge this capture just created.
    const intent = await stripeClient().paymentIntents.capture(
      intentId,
      { expand: ["latest_charge"] },
      { idempotencyKey },
    );
    return toSnapshot(intent);
  } catch (error) {
    throw toAppError(error, "No se pudo capturar el pago.");
  }
}

async function cancelPayment(intentId: string, idempotencyKey: string): Promise<PaymentSnapshot> {
  try {
    const intent = await stripeClient().paymentIntents.cancel(intentId, {}, { idempotencyKey });
    return toSnapshot(intent);
  } catch (error) {
    throw toAppError(error, "No se pudo cancelar la autorización del pago.");
  }
}

async function retrievePayment(intentId: string): Promise<PaymentSnapshot> {
  try {
    // Expanded for the same reason as `capturePayment` — the reconciliation
    // job and the webhook's `succeeded` handler (which gets an unexpanded
    // charge id on the event payload itself) both need the card off this call.
    return toSnapshot(
      await stripeClient().paymentIntents.retrieve(intentId, { expand: ["latest_charge"] }),
    );
  } catch (error) {
    throw toAppError(error, "No se pudo consultar el estado del pago.");
  }
}

async function refundPayment(intentId: string, idempotencyKey: string): Promise<PaymentSnapshot> {
  try {
    const stripe = stripeClient();
    await stripe.refunds.create({ payment_intent: intentId }, { idempotencyKey });
    // Re-read rather than deriving from the refund object: the PaymentIntent is
    // the single source of truth for what state this payment is now in.
    return toSnapshot(await stripe.paymentIntents.retrieve(intentId));
  } catch (error) {
    throw toAppError(error, "No se pudo reembolsar el pago.");
  }
}

/**
 * Verifies the signature against the **raw** body bytes.
 *
 * `constructEvent` both checks the HMAC and enforces the timestamp tolerance,
 * which is what stops a captured event from being replayed later. It throws on
 * any mismatch — and the caller must let it, because an unverified payload is
 * an attacker's payload, not a degraded one.
 */
function verifyWebhook(rawBody: Buffer, signature: string | undefined): PaymentEventEnvelope {
  if (!env.isStripeConfigured) throw notConfigured();
  if (!signature) {
    throw new AppError("Falta la firma del webhook.", 400);
  }

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.stripeWebhookSecret,
      env.stripeWebhookToleranceSeconds,
    );
  } catch {
    // The reason is deliberately not echoed back: a caller who cannot produce a
    // valid signature has no business learning whether they got the timestamp
    // or the secret wrong.
    throw new AppError("Firma de webhook inválida.", 400);
  }

  const object = event.data.object as unknown as Record<string, unknown>;
  const intentId = extractIntentId(object, event.type);
  const amount = object["amount"];
  const refunded = object["amount_refunded"];
  const failure = (object["last_payment_error"] as { message?: unknown } | undefined)?.message;

  return {
    id: event.id,
    type: event.type,
    ...(intentId !== undefined ? { intentId } : {}),
    metadata: extractMetadata(object),
    ...(typeof amount === "number" ? { amountCents: amount } : {}),
    ...(typeof refunded === "number" ? { refundedAmountCents: refunded } : {}),
    ...(typeof failure === "string" ? { failureMessage: failure } : {}),
    occurredAt: new Date(event.created * 1000),
  };
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",
  get isConfigured() {
    return env.isStripeConfigured;
  },
  createPayment,
  capturePayment,
  cancelPayment,
  retrievePayment,
  refundPayment,
  verifyWebhook,
};

export { AUTHORIZATION_LIFETIME_DAYS };
