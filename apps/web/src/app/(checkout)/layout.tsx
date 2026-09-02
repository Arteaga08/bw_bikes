import type { ReactNode } from "react";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { CartProvider } from "@/components/cart/CartProvider";
import { SkipLink } from "@/components/shell/SkipLink";
import { ToastProvider } from "@/components/ui/Toast";
import { requireCustomerSession } from "@/lib/auth/session";

/**
 * The checkout's own route group — sibling to `(storefront)`, not nested
 * inside it. `DESIGN_SYSTEM.md:325,350` requires zero rinoceronte
 * appearances, no footer, and a reduced nav on every checkout screen; the
 * only way to guarantee that is a chrome this tree owns outright, rather
 * than hiding `(storefront)`'s `Footer`/`Navbar` per-route.
 *
 * No `CartDrawer` here either — opening a cart drawer over a payment form
 * would be a UX error, and `CheckoutHeader`'s "Volver al carrito" already
 * covers "I want to go edit my cart".
 *
 * The session guard lives once, here, for the whole route group — same
 * pattern as `mi-cuenta/layout.tsx` — so no page under `/checkout` repeats it.
 */
export default async function CheckoutLayout({ children }: { children: ReactNode }) {
  await requireCustomerSession("/checkout/envio");

  return (
    <ToastProvider>
      <CartProvider>
        <SkipLink targetId="contenido" />
        <CheckoutHeader />
        <main id="contenido" tabIndex={-1} className="bg-base focus:outline-none">
          {children}
        </main>
      </CartProvider>
    </ToastProvider>
  );
}
