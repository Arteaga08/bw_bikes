import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit-level test for `stripeProvider.createPayment` itself — every other
 * suite drives checkout through `tests/helpers/stripe.ts`'s stub, which
 * replaces `stripeProvider.createPayment` entirely and therefore never
 * exercises what this adapter actually sends to the Stripe SDK. This file
 * mocks one layer lower, at the `stripe` package boundary, so the shape of
 * the real `paymentIntents.create()` call is what gets asserted.
 *
 * Regression coverage for the 3D Secure gap found in the security audit: the
 * adapter used to send no `payment_method_options` at all, leaving the SCA
 * challenge decision entirely to Stripe's dashboard defaults instead of this
 * codebase's own `Settings.orders.requestThreeDSecure`.
 */

const createMock = vi.fn();
const captureMock = vi.fn();
const retrieveMock = vi.fn();

vi.mock("stripe", () => {
  class FakeStripe {
    static API_VERSION = "2024-01-01";
    static errors = {
      StripeCardError: class StripeCardError extends Error {},
      StripeInvalidRequestError: class StripeInvalidRequestError extends Error {},
    };
    paymentIntents = { create: createMock, capture: captureMock, retrieve: retrieveMock };
  }
  return { default: FakeStripe };
});

describe("stripeProvider.createPayment", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({
      id: "pi_test_unit",
      client_secret: "pi_test_unit_secret",
      status: "requires_payment_method",
      created: Math.floor(Date.now() / 1000),
      last_payment_error: null,
    });
  });

  it("requests the 3D Secure policy from the caller, never a hardcoded literal", async () => {
    const { stripeProvider } = await import("../src/services/payments/stripe.provider.js");

    await stripeProvider.createPayment({
      amountCents: 1000,
      currency: "MXN",
      captureMethod: "automatic",
      idempotencyKey: "order_unit_1",
      metadata: { orderId: "unit1", orderNumber: "BW-2026-UNIT01" },
      requestThreeDSecure: "any",
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const [params] = createMock.mock.calls[0]!;
    expect(params.payment_method_options).toEqual({ card: { request_three_d_secure: "any" } });
  });

  it("sends the shipping address as a Radar signal when the order has one", async () => {
    const { stripeProvider } = await import("../src/services/payments/stripe.provider.js");

    await stripeProvider.createPayment({
      amountCents: 1000,
      currency: "MXN",
      captureMethod: "automatic",
      idempotencyKey: "order_unit_2",
      metadata: { orderId: "unit2", orderNumber: "BW-2026-UNIT02" },
      requestThreeDSecure: "automatic",
      shippingAddress: {
        recipientName: "Ada Lovelace",
        phone: "5512345678",
        street: "Av. Siempre Viva 123",
        neighborhood: "Centro",
        city: "Ciudad de México",
        state: "Ciudad de México",
        postalCode: "01000",
        country: "MX",
      },
    });

    const [params] = createMock.mock.calls[0]!;
    expect(params.shipping).toMatchObject({
      name: "Ada Lovelace",
      phone: "5512345678",
      address: {
        line1: "Av. Siempre Viva 123",
        city: "Ciudad de México",
        state: "Ciudad de México",
        postal_code: "01000",
        country: "MX",
      },
    });
  });

  it("omits shipping entirely rather than sending a partial/empty object when the order has none", async () => {
    const { stripeProvider } = await import("../src/services/payments/stripe.provider.js");

    await stripeProvider.createPayment({
      amountCents: 1000,
      currency: "MXN",
      captureMethod: "automatic",
      idempotencyKey: "order_unit_3",
      metadata: { orderId: "unit3", orderNumber: "BW-2026-UNIT03" },
      requestThreeDSecure: "automatic",
    });

    const [params] = createMock.mock.calls[0]!;
    expect(params.shipping).toBeUndefined();
  });
});

/**
 * Regression coverage for M11.5's card-on-file surface (the admin detail's
 * "•••• 4242" line). Both calls are asserted at the same SDK boundary as
 * above, because the bug this guards against — forgetting `expand:
 * ["latest_charge"]` — would otherwise pass silently: `latest_charge` comes
 * back as a bare string id without it, and `toSnapshot` already treats that
 * shape as "no card", the same as an intent that hasn't been captured yet.
 */
describe("stripeProvider — card details (M11.5)", () => {
  beforeEach(() => {
    captureMock.mockReset();
    retrieveMock.mockReset();
  });

  const chargedIntent = (overrides: { id: string; status: string }) => ({
    ...overrides,
    created: Math.floor(Date.now() / 1000),
    last_payment_error: null,
    latest_charge: {
      payment_method_details: { card: { brand: "visa", last4: "4242" } },
    },
  });

  it("capturePayment asks Stripe to expand latest_charge, and reads the card back", async () => {
    captureMock.mockResolvedValue(chargedIntent({ id: "pi_capture_1", status: "succeeded" }));
    const { stripeProvider } = await import("../src/services/payments/stripe.provider.js");

    const snapshot = await stripeProvider.capturePayment("pi_capture_1", "capture_key_1");

    const [, params] = captureMock.mock.calls[0]!;
    expect(params).toMatchObject({ expand: ["latest_charge"] });
    expect(snapshot.card).toEqual({ brand: "visa", last4: "4242" });
  });

  it("retrievePayment likewise expands latest_charge and reads the card back", async () => {
    retrieveMock.mockResolvedValue(chargedIntent({ id: "pi_retrieve_1", status: "succeeded" }));
    const { stripeProvider } = await import("../src/services/payments/stripe.provider.js");

    const snapshot = await stripeProvider.retrievePayment("pi_retrieve_1");

    const [, params] = retrieveMock.mock.calls[0]!;
    expect(params).toMatchObject({ expand: ["latest_charge"] });
    expect(snapshot.card).toEqual({ brand: "visa", last4: "4242" });
  });

  it("omits card entirely when latest_charge isn't expanded (webhook-shaped payload)", async () => {
    retrieveMock.mockResolvedValue({
      id: "pi_retrieve_2",
      status: "succeeded",
      created: Math.floor(Date.now() / 1000),
      last_payment_error: null,
      latest_charge: "ch_not_expanded",
    });
    const { stripeProvider } = await import("../src/services/payments/stripe.provider.js");

    const snapshot = await stripeProvider.retrievePayment("pi_retrieve_2");

    expect(snapshot.card).toBeUndefined();
  });
});

/**
 * `mapState`'s full table (Sesión 3 audit) — every other test in this file
 * only ever exercises `succeeded`, so a status this domain gets wrong would
 * otherwise pass unnoticed. Driven through `retrievePayment` since `mapState`
 * itself isn't exported — the adapter boundary is `PaymentSnapshot.state`,
 * not the private Stripe-status switch behind it.
 */
describe("stripeProvider — payment state mapping (all 7 Stripe statuses)", () => {
  beforeEach(() => {
    retrieveMock.mockReset();
  });

  const intentWithStatus = (status: string, overrides: Record<string, unknown> = {}) => ({
    id: "pi_state_test",
    status,
    created: Math.floor(Date.now() / 1000),
    last_payment_error: null,
    latest_charge: null,
    ...overrides,
  });

  it.each([
    ["succeeded", "captured"],
    ["requires_capture", "authorized"],
    ["canceled", "canceled"],
    ["requires_payment_method", "pending"],
    ["requires_confirmation", "pending"],
    ["requires_action", "pending"],
    ["processing", "pending"],
  ] as const)("maps Stripe status %s to PaymentState %s", async (stripeStatus, expectedState) => {
    retrieveMock.mockResolvedValue(intentWithStatus(stripeStatus));
    const { stripeProvider } = await import("../src/services/payments/stripe.provider.js");

    const snapshot = await stripeProvider.retrievePayment("pi_state_test");

    expect(snapshot.state).toBe(expectedState);
  });

  it("maps requires_payment_method with a last_payment_error to failed, not pending", async () => {
    retrieveMock.mockResolvedValue(
      intentWithStatus("requires_payment_method", { last_payment_error: { message: "Tarjeta rechazada" } }),
    );
    const { stripeProvider } = await import("../src/services/payments/stripe.provider.js");

    const snapshot = await stripeProvider.retrievePayment("pi_state_test");

    expect(snapshot.state).toBe("failed");
  });
});
