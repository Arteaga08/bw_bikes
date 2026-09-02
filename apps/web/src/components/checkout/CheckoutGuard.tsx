"use client";

import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react/ssr";
import { useCart } from "@/components/cart/CartProvider";
import { CartUnauthenticated } from "@/components/cart/CartUnauthenticated";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckoutSkeleton } from "./CheckoutSkeleton";

export interface CheckoutGuardProps {
  /** The two accordion cards (shipping + billing) — disabled as a group when `hasBlockingLines`, never hidden. */
  steps: ReactNode;
  /** The sticky summary column — stays interactive even when `steps` is disabled, so "Volver al carrito" and the coupon form remain reachable. */
  summary: ReactNode;
}

/**
 * The switch over `useCart().status` from C1-checkout-datos.md §2 — same
 * shape as `CartPageClient`, plus one case it doesn't have: a cart with
 * `hasBlockingLines` renders the form disabled behind a banner instead of
 * replacing it. None of these cases navigate on their own; only the visitor
 * decides to leave.
 */
export function CheckoutGuard({ steps, summary }: CheckoutGuardProps) {
  const { cart, status } = useCart();

  if (status === "idle" || status === "loading") {
    return <CheckoutSkeleton />;
  }

  if (status === "anonymous") {
    return <CartUnauthenticated />;
  }

  if (status === "error" || !cart) {
    return (
      <div className="flex flex-col items-center gap-md rounded-card border border-borde bg-surface p-xl text-center">
        <WarningCircle size={32} weight="regular" aria-hidden="true" className="text-estado-error" />
        <p className="font-ui text-ui text-negro">No pudimos cargar tu carrito.</p>
        <Button variant="secondary" size="md" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        title="Tu carrito está vacío"
        description="Agrega algo al carrito antes de pasar al checkout."
        action={
          <ButtonLink href="/catalogo" variant="primary" size="md">
            Ver catálogo
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-[1fr_21rem] lg:items-start">
      <div className="flex flex-col gap-md">
        {cart.hasBlockingLines ? (
          <p className="flex items-center gap-xs rounded-control bg-estado-error-soft px-md py-sm font-body text-caption text-estado-error">
            <WarningCircle size={16} weight="regular" aria-hidden="true" className="shrink-0" />
            Ajusta los productos marcados para poder continuar.{" "}
            <ButtonLink href="/carrito" variant="text" size="sm">
              Volver al carrito
            </ButtonLink>
          </p>
        ) : null}
        <fieldset disabled={cart.hasBlockingLines} className="contents border-0 p-0 m-0">
          {steps}
        </fieldset>
      </div>
      <div className="lg:sticky lg:top-[88px]">{summary}</div>
    </div>
  );
}
