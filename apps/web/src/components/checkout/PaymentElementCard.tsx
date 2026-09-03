"use client";

import type { CaptureMethod } from "@bw-bikes/shared";
import type { ReactNode } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe/client";

export interface PaymentElementCardProps {
  /** `cart.totalCents` — the deferred Element needs an amount to render before any order/PaymentIntent exists. */
  amount: number;
  currency: string;
  captureMethod: CaptureMethod;
  children: ReactNode;
}

/**
 * Stripe Elements in **deferred mode** (`mode: "payment"`, no `clientSecret`)
 * with the project's appearance (C2-checkout-pago.md §3). `boxShadow: "none"`
 * is explicit because `theme: "flat"` draws a shadow by default and
 * `DESIGN_SYSTEM.md` §3.2 prohibits shadows without exception.
 *
 * Deferred mode lets the card fields mount the instant the Pago step opens,
 * before any order exists — the order (and its PaymentIntent) is only
 * created when the customer presses "Pagar" (see `PaymentCard`). Without it,
 * showing the card fields immediately would require creating an order (and
 * reserving inventory) for every visitor who merely reaches this step.
 *
 * `paymentMethodTypes: ["card"]` must match the server's own
 * `payment_method_types` (`stripe.provider.ts:210`) — deferred mode has no
 * PaymentIntent yet to read that from, so it has to be declared on both
 * sides, and a mismatch here would make `elements.submit()`/`confirmPayment`
 * behave as if the customer chose a payment method the backend never offers.
 */
export function PaymentElementCard({ amount, currency, captureMethod, children }: PaymentElementCardProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount,
        currency: currency.toLowerCase(),
        captureMethod,
        paymentMethodTypes: ["card"],
        locale: "es",
        appearance: {
          theme: "flat",
          variables: {
            fontFamily: "Hanken Grotesk, sans-serif",
            colorPrimary: "#f2b705",
            colorText: "#0a0a0a",
            colorBackground: "#ffffff",
            colorDanger: "#7a3b32",
            borderRadius: "2px",
          },
          rules: { ".Input": { boxShadow: "none", border: "1px solid #e2e2de" } },
        },
      }}
    >
      {children}
    </Elements>
  );
}
