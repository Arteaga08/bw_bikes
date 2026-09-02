"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useCart } from "@/components/cart/CartProvider";
import { PaymentElementCard } from "@/components/checkout/PaymentElementCard";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { createOrder } from "@/lib/api/checkout";
import { ApiError } from "@/lib/api/error";
import { checkoutIdempotencyKey } from "@/lib/checkout/idempotency-key";
import { formatCurrencyCents } from "@/lib/format";

type CreationState =
  | { phase: "creating" }
  | { phase: "ready"; clientSecret: string; orderNumber: string; totalCents: number; captureMethod: "automatic" | "manual" }
  | { phase: "error"; message: string; kind: "redirect-cart" | "retry" | "maintenance" };

/** `error.type` values that already carry a safe, Spanish, user-facing message (C2-checkout-pago.md §4). */
const SAFE_STRIPE_ERROR_TYPES = new Set(["card_error", "validation_error"]);
const GENERIC_STRIPE_ERROR = "No se pudo procesar el pago. Intenta de nuevo.";

/**
 * Creates the order on mount (idempotent — see `checkoutIdempotencyKey`),
 * then mounts Stripe Elements and confirms the payment. `redirect: "if_required"`
 * means the non-3DS path resolves in this same component and navigates via
 * `router.push`; the 3DS path leaves via Stripe's own redirect to the same
 * `return_url` — one destination for both (C2-checkout-pago.md §4).
 */
export function PaymentStepView() {
  const { cart } = useCart();
  const router = useRouter();
  const [state, setState] = useState<CreationState>({ phase: "creating" });
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cart) return;

    if (!cart.shippingAddress) {
      router.replace("/checkout/envio");
      return;
    }

    const key = checkoutIdempotencyKey(cart.updatedAt);
    lastKeyRef.current = key;
    void runCreateOrder(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.updatedAt]);

  async function runCreateOrder(key: string): Promise<void> {
    setState({ phase: "creating" });
    try {
      const { order, clientSecret } = await createOrder(key);
      setState({
        phase: "ready",
        clientSecret,
        orderNumber: order.orderNumber,
        totalCents: order.totals.totalCents,
        captureMethod: order.payment.captureMethod,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.httpStatus === 400) {
          router.replace("/checkout/envio");
          return;
        }
        if (error.httpStatus === 502) {
          setState({ phase: "error", message: error.message, kind: "retry" });
          return;
        }
        if (error.httpStatus === 503) {
          setState({ phase: "error", message: error.message, kind: "maintenance" });
          return;
        }
        // 409 (already processed) and 429 (rate limited) both mean "stop
        // trying here" — send the customer back to the cart rather than
        // offer a retry that will just repeat the same rejection.
        setState({ phase: "error", message: error.message, kind: "redirect-cart" });
        return;
      }
      setState({ phase: "error", message: "No se pudo iniciar el pago. Intenta de nuevo.", kind: "retry" });
    }
  }

  if (!cart || state.phase === "creating") {
    return <p className="font-body text-body text-grafito">Preparando tu pago…</p>;
  }

  if (state.phase === "error") {
    if (state.kind === "maintenance") {
      return <p className="rounded-card border border-borde bg-surface p-lg font-body text-body text-negro">{state.message}</p>;
    }
    return (
      <div className="flex flex-col gap-md rounded-card border border-borde bg-surface p-lg">
        <p className="font-body text-body text-negro">{state.message}</p>
        {state.kind === "retry" ? (
          <Button variant="primary" size="md" onClick={() => lastKeyRef.current && void runCreateOrder(lastKeyRef.current)}>
            Reintentar
          </Button>
        ) : (
          <ButtonLink href="/carrito" variant="primary" size="md">
            Volver al carrito
          </ButtonLink>
        )}
      </div>
    );
  }

  return (
    <PaymentElementCard clientSecret={state.clientSecret}>
      <PaymentForm orderNumber={state.orderNumber} totalCents={state.totalCents} captureMethod={state.captureMethod} />
    </PaymentElementCard>
  );
}

interface PaymentFormProps {
  orderNumber: string;
  totalCents: number;
  captureMethod: "automatic" | "manual";
}

function PaymentForm({ orderNumber, totalCents, captureMethod }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handlePay(): Promise<void> {
    if (!stripe || !elements) return;
    setConfirmError(null);
    setConfirming(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/gracias/${orderNumber}` },
        redirect: "if_required",
      });

      if (error) {
        setConfirmError(SAFE_STRIPE_ERROR_TYPES.has(error.type) ? (error.message ?? GENERIC_STRIPE_ERROR) : GENERIC_STRIPE_ERROR);
        return;
      }

      router.push(`/gracias/${orderNumber}`);
    } finally {
      setConfirming(false);
    }
  }

  const label = captureMethod === "manual" ? `Autorizar ${formatCurrencyCents(totalCents)}` : `Pagar ${formatCurrencyCents(totalCents)}`;

  return (
    <div className="flex flex-col gap-md">
      <PaymentElement />
      {captureMethod === "manual" ? (
        <p className="rounded-control bg-estado-advertencia-soft px-md py-sm font-body text-caption text-estado-advertencia">
          El cargo se autoriza ahora y se cobra cuando el proveedor confirme el stock.
        </p>
      ) : null}
      {confirmError ? <p className="font-body text-caption text-estado-error">{confirmError}</p> : null}
      <Button variant="primary" size="md" loading={confirming} onClick={() => void handlePay()}>
        {label}
      </Button>
    </div>
  );
}
