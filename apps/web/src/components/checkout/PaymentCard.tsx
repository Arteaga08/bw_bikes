"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useCart } from "@/components/cart/CartProvider";
import { PaymentElementCard } from "@/components/checkout/PaymentElementCard";
import { TermsCheckbox } from "@/components/checkout/TermsCheckbox";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { createOrder } from "@/lib/api/checkout";
import { ApiError } from "@/lib/api/error";
import { checkoutIdempotencyKey } from "@/lib/checkout/idempotency-key";
import { formatCurrencyCents } from "@/lib/format";

/** `error.type` values that already carry a safe, Spanish, user-facing message (C2-checkout-pago.md §4). */
const SAFE_STRIPE_ERROR_TYPES = new Set(["card_error", "validation_error"]);
const GENERIC_STRIPE_ERROR = "No se pudo procesar el pago. Intenta de nuevo.";

type PayErrorKind = "retry" | "redirect-cart" | "maintenance";

interface PayError {
  kind: PayErrorKind;
  message: string;
}

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
      <PaymentElementCard amount={cart.totalCents} currency={cart.currency} captureMethod={cart.captureMethod}>
        <PaymentForm />
      </PaymentElementCard>
    </section>
  );
}

function PaymentForm() {
  const { cart } = useCart();
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<PayError | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  async function handlePay(): Promise<void> {
    if (!stripe || !elements || !cart || !termsAccepted) return;

    setError(null);
    setPaying(true);
    try {
      // Deferred mode still requires validating the Element's own fields
      // before anything else — a card left incomplete must never reach
      // `createOrder`, which would otherwise mint an order (and reserve
      // inventory) for a payment that was never going to confirm.
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError({ kind: "retry", message: submitError.message ?? GENERIC_STRIPE_ERROR });
        return;
      }

      const key = checkoutIdempotencyKey(cart.updatedAt);
      lastKeyRef.current = key;
      const { order, clientSecret } = await createOrder(new Date().toISOString(), key);

      // The server re-prices from fresh snapshots (`order.service.ts`), so it
      // can disagree with the cart preview this Element was mounted with — a
      // price or stock change, or a coupon that expired in between. Confirming
      // against a stale amount/captureMethod would make Stripe reject the
      // request with an unreadable integration error, so bail out instead.
      if (order.totals.totalCents !== cart.totalCents || order.payment.captureMethod !== cart.captureMethod) {
        setError({
          kind: "redirect-cart",
          message: "El total de tu pedido cambió. Vuelve al carrito para revisarlo.",
        });
        return;
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: { return_url: `${window.location.origin}/gracias/${order.orderNumber}` },
        redirect: "if_required",
      });

      if (confirmError) {
        setError({
          kind: "retry",
          message: SAFE_STRIPE_ERROR_TYPES.has(confirmError.type) ? (confirmError.message ?? GENERIC_STRIPE_ERROR) : GENERIC_STRIPE_ERROR,
        });
        return;
      }

      router.push(`/gracias/${order.orderNumber}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.httpStatus === 502) {
          setError({ kind: "retry", message: err.message });
          return;
        }
        if (err.httpStatus === 503) {
          setError({ kind: "maintenance", message: err.message });
          return;
        }
        // 400 (empty cart / invalid quantity), 409 (already processed) and
        // 429 (rate limited) all mean "stop trying here, this is a cart
        // problem" — show the backend's own message and send the customer
        // back to the cart rather than a silent retry that would just repeat
        // the same rejection.
        setError({ kind: "redirect-cart", message: err.message });
        return;
      }
      setError({ kind: "retry", message: "No se pudo iniciar el pago. Intenta de nuevo." });
    } finally {
      setPaying(false);
    }
  }

  const captureMethod = cart?.captureMethod ?? "automatic";
  const label =
    captureMethod === "manual" ? `Autorizar ${formatCurrencyCents(cart?.totalCents ?? 0)}` : `Pagar ${formatCurrencyCents(cart?.totalCents ?? 0)}`;

  return (
    <div className="flex flex-col gap-md">
      <PaymentElement onReady={() => setElementReady(true)} />

      {captureMethod === "manual" ? (
        <p className="rounded-control bg-estado-advertencia-soft px-md py-sm font-body text-caption text-estado-advertencia">
          El cargo se autoriza ahora y se cobra cuando el proveedor confirme el stock.
        </p>
      ) : null}

      <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />

      {error ? (
        error.kind === "maintenance" ? (
          <p className="font-body text-caption text-negro">{error.message}</p>
        ) : (
          <div className="flex flex-col gap-xs">
            <p className="font-body text-caption text-estado-error">{error.message}</p>
            {error.kind === "redirect-cart" ? (
              <ButtonLink href="/carrito" variant="text" size="sm">
                Volver al carrito
              </ButtonLink>
            ) : null}
          </div>
        )
      ) : null}

      <Button
        variant="primary"
        size="md"
        loading={paying}
        disabled={!elementReady || !termsAccepted || error?.kind === "maintenance"}
        onClick={() => void handlePay()}
      >
        {label}
      </Button>
      {!termsAccepted ? <p className="font-body text-caption text-grafito">Acepta los términos para habilitar el pago.</p> : null}
    </div>
  );
}
