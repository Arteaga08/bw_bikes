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

vi.mock("stripe", () => {
  class FakeStripe {
    static API_VERSION = "2024-01-01";
    static errors = {
      StripeCardError: class StripeCardError extends Error {},
      StripeInvalidRequestError: class StripeInvalidRequestError extends Error {},
    };
    paymentIntents = { create: createMock };
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
