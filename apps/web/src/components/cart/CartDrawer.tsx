"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { formatCurrencyCents } from "@/lib/format";
import { CartDrawerCloseIcon } from "./CartDrawerCloseIcon";
import { CartEmpty } from "./CartEmpty";
import { CartLineItem } from "./CartLineItem";
import { useCart } from "./CartProvider";

export interface CartDrawerProps {
  /** Read server-side (`cloudinaryCloudName()`) in the layout and threaded down — see `CartLineItem`. */
  cloudName: string;
}

/**
 * Mounted once en `(storefront)/layout.tsx`, never per page (`B-carrito.md`
 * §6). No CTA de pago aquí — la conversión completa vive en `/carrito` →
 * `CartSummary`, y de ahí a `/checkout` (C1-checkout-datos.md), nunca en el
 * drawer.
 */
export function CartDrawer({ cloudName }: CartDrawerProps) {
  const { cart, status, drawerOpen, closeDrawer } = useCart();

  const lines = cart?.lines ?? [];

  return (
    <SlideOver
      open={drawerOpen}
      onClose={closeDrawer}
      title="Tu carrito"
      closeButtonSize="icon-lg"
      closeButtonClassName="hover:!text-dorado"
      closeButtonIcon={<CartDrawerCloseIcon />}
      footer={
        lines.length > 0 ? (
          <div className="flex w-full flex-col gap-sm">
            <div className="flex items-center justify-between font-ui text-ui text-negro">
              <span>Subtotal</span>
              <span>{cart ? formatCurrencyCents(cart.subtotalCents) : null}</span>
            </div>
            <Link href="/carrito" onClick={closeDrawer}>
              <Button variant="primary" size="md" className="w-full">
                Ver carrito
              </Button>
            </Link>
            <Button variant="ghost" size="md" className="w-full" onClick={closeDrawer}>
              Seguir comprando
            </Button>
          </div>
        ) : undefined
      }
    >
      {status === "loading" ? null : lines.length === 0 ? (
        <CartEmpty onNavigate={closeDrawer} />
      ) : (
        <ul className="flex flex-col gap-lg">
          {lines.map((line) => (
            <CartLineItem key={`${line.itemType}:${line.sku}`} line={line} cloudName={cloudName} compact />
          ))}
        </ul>
      )}
    </SlideOver>
  );
}
