import { AppError } from "../../utils/index.js";
import type { PaymentProvider } from "./payment-provider.interface.js";
import { stripeProvider } from "./stripe.provider.js";

export type * from "./payment-provider.interface.js";

/**
 * Selects the payment gateway.
 *
 * One adapter exists today, as the design spec fixed ("solo Stripe, detrás de
 * un adapter"). The indirection is not speculative: interest-free instalments
 * in Mexico effectively require Mercado Pago, and the day that lands it
 * becomes a second entry here rather than a change to any service that takes
 * money.
 *
 * ## No stub, on purpose
 *
 * Every other integration in this codebase degrades to something harmless when
 * unconfigured — the mailer logs instead of sending, uploads answer 503. A
 * payment stub cannot be harmless: an order marked paid by a fake gateway is
 * indistinguishable from a real sale until someone looks for the money. So
 * when credentials are missing the provider is returned as-is and every call
 * refuses with an explicit 503.
 */
function getPaymentProvider(): PaymentProvider {
  return stripeProvider;
}

/**
 * Guard for routes that cannot do anything useful without a gateway. Called at
 * the top of checkout and the webhook so the failure is a clear 503 at the
 * edge, rather than an opaque error from inside a half-built order.
 */
function assertPaymentsConfigured(): void {
  if (!getPaymentProvider().isConfigured) {
    throw new AppError("Los pagos no están configurados en este entorno. Contacta al administrador.", 503);
  }
}

export { assertPaymentsConfigured, getPaymentProvider };
