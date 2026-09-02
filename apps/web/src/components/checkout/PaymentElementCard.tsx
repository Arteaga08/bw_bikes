"use client";

import type { ReactNode } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe/client";

export interface PaymentElementCardProps {
  clientSecret: string;
  children: ReactNode;
}

/**
 * Stripe Elements with the project's appearance (C2-checkout-pago.md §3).
 * `boxShadow: "none"` is explicit because `theme: "flat"` draws a shadow by
 * default and `DESIGN_SYSTEM.md` §3.2 prohibits shadows without exception.
 * `payment_method_types: ["card"]` is fixed server-side
 * (`stripe.provider.ts:210`), so the Element only ever offers a card field —
 * expected, not a limitation introduced here.
 */
export function PaymentElementCard({ clientSecret, children }: PaymentElementCardProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
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
