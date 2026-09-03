"use client";

import type { PublicOrder } from "@bw-bikes/shared";
import { Clock } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { RhinoMark } from "@/components/storefront/RhinoMark";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { getOrderByNumber } from "@/lib/api/checkout";
import { cn } from "@/lib/cn";
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
  // `markCanceled` (order.service.ts) writes status:"authorization_expired",
  // not "cancelled", when a manual-capture hold lapses — that shape must
  // read as "failed" too, or the order would poll for the full 15 attempts
  // and land on the generic timeout screen instead of an immediate, honest
  // failure message.
  if (order.payment.state === "failed" || order.status === "cancelled" || order.status === "authorization_expired") {
    return { kind: "failed" };
  }
  if (order.status === "paid") return { kind: "paid", order };
  if (order.status === "awaiting_supplier_confirmation") return { kind: "authorized", order };
  return null;
}

export interface OrderConfirmationViewProps {
  orderNumber: string;
}

/**
 * The one card every screen below renders into (`bg-surface`/`rounded-card-lg`/
 * `border-borde`, the same recipe `pedidos/[orderNumber]/page.tsx` uses) —
 * chosen so the five states read as one component evolving, not five
 * unrelated screens. `min-h-[calc(100dvh-4rem)]` (the `carrito/page.tsx`
 * pattern, subtracting the fixed `h-16` navbar) centers it in the space
 * above the footer instead of just padding it, so a one-line state no
 * longer leaves the footer crowding the content.
 */
function ConfirmationCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-lg">
      <div
        className={cn(
          "flex w-full max-w-card flex-col items-center gap-md rounded-card-lg border border-borde bg-surface p-2xl text-center",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
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
      <ConfirmationCard>
        <RhinoMark className="h-5 w-auto" />
        <p className="font-body text-body text-grafito">Estamos confirmando tu pago…</p>
        <span className="skeleton h-1 w-40" aria-hidden="true" />
      </ConfirmationCard>
    );
  }

  if (screen.kind === "paid") {
    return (
      <ConfirmationCard className="motion-safe:animate-hero-in">
        <p className="flex items-center gap-sm font-body text-eyebrow uppercase text-grafito">
          <RhinoMark className="h-5 w-auto" />
          Pedido confirmado
        </p>
        <h1 className="font-display text-h3 text-negro">{screen.order.orderNumber}</h1>
        <p className="font-body text-body text-negro">{formatCurrencyCents(screen.order.totals.totalCents)}</p>
        <ButtonLink href={`/pedidos/${screen.order.orderNumber}`} variant="primary" size="md">
          Ver mi pedido
        </ButtonLink>
      </ConfirmationCard>
    );
  }

  if (screen.kind === "authorized") {
    return (
      <ConfirmationCard className="motion-safe:animate-hero-in">
        <p className="flex items-center gap-sm font-body text-eyebrow uppercase text-grafito">
          <RhinoMark className="h-5 w-auto" />
          Pago autorizado
        </p>
        <h1 className="font-display text-h3 text-negro">{screen.order.orderNumber}</h1>
        <p className="font-body text-body text-negro">
          El cargo se autorizó y se confirma cuando el proveedor confirme el stock.
        </p>
        <ButtonLink href={`/pedidos/${screen.order.orderNumber}`} variant="primary" size="md">
          Ver mi pedido
        </ButtonLink>
      </ConfirmationCard>
    );
  }

  if (screen.kind === "failed") {
    return (
      <ConfirmationCard>
        <h1 className="font-display text-h3 text-negro">No pudimos procesar tu pago</h1>
        <p className="font-body text-body text-grafito">Tu carrito sigue disponible, puedes intentar de nuevo.</p>
        <ButtonLink href="/carrito" variant="primary" size="md">
          Volver al carrito
        </ButtonLink>
      </ConfirmationCard>
    );
  }

  return (
    <ConfirmationCard>
      <RhinoMark className="h-5 w-auto" />
      <div className="flex items-center gap-sm">
        <Clock size={20} className="text-grafito" aria-hidden="true" />
        <h1 className="font-display text-h3 text-negro">Tu pago sigue procesándose</h1>
      </div>
      <p className="font-body text-body text-grafito">Te avisamos por correo en cuanto se confirme.</p>
      <ButtonLink href="/mi-cuenta/pedidos" variant="primary" size="md">
        Ver mis pedidos
      </ButtonLink>
    </ConfirmationCard>
  );
}
