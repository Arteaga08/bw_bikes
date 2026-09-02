import type { Metadata } from "next";
import { PaymentStepView } from "./PaymentStepView";

export const metadata: Metadata = {
  title: "Pago",
  robots: { index: false, follow: false },
};

/** The session guard and `CartProvider` already run in `(checkout)/layout.tsx`. */
export default function CheckoutPaymentPage() {
  return <PaymentStepView />;
}
