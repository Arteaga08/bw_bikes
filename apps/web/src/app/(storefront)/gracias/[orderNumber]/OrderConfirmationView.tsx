"use client";

import type { PublicOrder } from "@bw-bikes/shared";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { RhinoMark } from "@/components/storefront/RhinoMark";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { getOrderByNumber } from "@/lib/api/checkout";
import { formatCurrencyCents } from "@/lib/format";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 15;

type Screen =
  | { kind: "pending" }
  | { kind: "paid"; order: PublicOrder }
  | { kind: "authorized"; order: PublicOrder }
  | { kind: "failed" }
  | { kind: "timeout" };

function screenFor(order: PublicOrder): Screen | null {
  if (order.payment.state === "failed" || order.status === "cancelled") return { kind: "failed" };
  if (order.status === "paid") return { kind: "paid", order };
  if (order.status === "awaiting_supplier_confirmation") return { kind: "authorized", order };
  return null;
}

export interface OrderConfirmationViewProps {
  orderNumber: string;
}

/**
 * Polls `GET /orders/number/:orderNumber` every 2s, up to 15 attempts
 * (C2-checkout-pago.md §5) — the webhook is the only thing that moves an
 * order past `pending_payment`, so this screen never trusts `confirmPayment`'s
 * own resolution, only what the order itself reports.
 */
export function OrderConfirmationView({ orderNumber }: OrderConfirmationViewProps) {
  const { refresh } = useCart();
  const [screen, setScreen] = useState<Screen>({ kind: "pending" });
  const attemptsRef = useRef(0);
  const refreshedRef = useRef(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function poll(): Promise<void> {
      if (cancelled || stoppedRef.current) return;
      attemptsRef.current += 1;

      try {
        const order = await getOrderByNumber(orderNumber);
        if (cancelled) return;

        const resolved = screenFor(order);
        if (resolved) {
          stoppedRef.current = true;
          setScreen(resolved);
          if ((resolved.kind === "paid" || resolved.kind === "authorized") && !refreshedRef.current) {
            refreshedRef.current = true;
            void refresh();
          }
          return;
        }

        if (attemptsRef.current >= MAX_ATTEMPTS) {
          stoppedRef.current = true;
          setScreen({ kind: "timeout" });
          return;
        }

        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch {
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          stoppedRef.current = true;
          setScreen({ kind: "timeout" });
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    }

    void poll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  if (screen.kind === "pending") {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-md px-lg py-3xl text-center">
        <p className="font-body text-body text-grafito">Estamos confirmando tu pago…</p>
      </div>
    );
  }

  if (screen.kind === "paid") {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-md px-lg py-3xl text-center">
        <p className="font-body text-eyebrow uppercase text-grafito">Pedido confirmado</p>
        <RhinoMark className="h-16 w-auto" />
        <h1 className="font-display text-h3 text-negro">{screen.order.orderNumber}</h1>
        <p className="font-body text-body text-negro">{formatCurrencyCents(screen.order.totals.totalCents)}</p>
        <ButtonLink href={`/pedidos/${screen.order.orderNumber}`} variant="primary" size="md">
          Ver mi pedido
        </ButtonLink>
      </div>
    );
  }

  if (screen.kind === "authorized") {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-md px-lg py-3xl text-center">
        <p className="font-body text-eyebrow uppercase text-grafito">Pago autorizado</p>
        <RhinoMark className="h-16 w-auto" />
        <h1 className="font-display text-h3 text-negro">{screen.order.orderNumber}</h1>
        <p className="font-body text-body text-negro">
          El cargo se autorizó y se confirma cuando el proveedor confirme el stock.
        </p>
        <ButtonLink href={`/pedidos/${screen.order.orderNumber}`} variant="primary" size="md">
          Ver mi pedido
        </ButtonLink>
      </div>
    );
  }

  if (screen.kind === "failed") {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-md px-lg py-3xl text-center">
        <h1 className="font-display text-h3 text-negro">No pudimos procesar tu pago</h1>
        <p className="font-body text-body text-grafito">Tu carrito sigue disponible, puedes intentar de nuevo.</p>
        <ButtonLink href="/carrito" variant="primary" size="md">
          Volver al carrito
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-md px-lg py-3xl text-center">
      <h1 className="font-display text-h3 text-negro">Tu pago sigue procesándose</h1>
      <p className="font-body text-body text-grafito">Te avisamos por correo en cuanto se confirme.</p>
      <ButtonLink href="/mi-cuenta/pedidos" variant="primary" size="md">
        Ver mis pedidos
      </ButtonLink>
    </div>
  );
}
