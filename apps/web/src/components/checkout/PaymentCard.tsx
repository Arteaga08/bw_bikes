"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCart } from "@/components/cart/CartProvider";

/**
 * The entire Stripe surface, loaded the first time this step opens. `ssr:
 * false` because the Element can only mount in a browser anyway, and the
 * fallback keeps the card from collapsing to nothing for the frame or two the
 * chunk takes to arrive — Stripe's own iframe needs a beat after that
 * regardless.
 */
const PaymentFields = dynamic(() => import("@/components/checkout/PaymentFields").then((mod) => mod.PaymentFields), {
  ssr: false,
  loading: () => <p className="font-body text-body text-grafito">Cargando el formulario de pago…</p>,
});

function CardHeading() {
  return (
    <div className="flex items-center gap-xs">
      <Image src="/brand/rhino-dorado.svg" alt="" width={24} height={24} className="shrink-0" />
      <h2 className="font-display text-h2 text-negro">Pago</h2>
    </div>
  );
}

export interface PaymentCardProps {
  /** Whether this card is the one open in the checkout accordion — see `ShippingStepView`. */
  open: boolean;
}

/**
 * The Pago card — third and last accordion of the checkout
 * (M-checkout-una-pagina). The card fields mount as soon as this step opens,
 * in Stripe's **deferred mode** (`PaymentElementCard`, no PaymentIntent yet):
 * there is nothing to redirect to on this one-page checkout if the customer
 * isn't ready, so it just shows a muted placeholder until Envío is done and
 * this step is open.
 *
 * That placeholder is also why the fields live behind `next/dynamic` in
 * `PaymentFields` (M-optimización): a customer sitting on the Contacto or
 * Envío step has no use for the Stripe SDK, and it used to be in the initial
 * bundle of `/checkout/envio` regardless.
 *
 * The order itself (`POST /orders`, requires `termsAcceptedAt`,
 * M13-checkout-redesign) is only created once the customer presses "Pagar" —
 * not merely by opening this step or checking the terms box — so nothing is
 * reserved (inventory, a `pending_payment` order, a PaymentIntent) for a
 * visitor who reaches this far and never pays.
 */
export function PaymentCard({ open }: PaymentCardProps) {
  const { cart } = useCart();

  if (!open || !cart?.shippingAddress) {
    return (
      <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
        <CardHeading />
        <p className="font-body text-body text-grafito">Completa tu dirección de envío para continuar al pago.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-lg rounded-card-lg border border-borde bg-surface p-xl">
      <CardHeading />
      <PaymentFields />
    </section>
  );
}
