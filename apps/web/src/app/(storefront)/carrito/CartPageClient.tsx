"use client";

import { WarningCircle } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/Button";
import { CartEmpty } from "@/components/cart/CartEmpty";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { useCart } from "@/components/cart/CartProvider";
import { CartSkeleton } from "@/components/cart/CartSkeleton";
import { CartSummary } from "@/components/cart/CartSummary";
import { CartUnauthenticated } from "@/components/cart/CartUnauthenticated";
import { CouponForm } from "@/components/cart/CouponForm";

export interface CartPageClientProps {
  /** Read server-side (`cloudinaryCloudName()`) in `page.tsx` and threaded down — see `CartLineItem`. */
  cloudName: string;
}

export function CartPageClient({ cloudName }: CartPageClientProps) {
  const { cart, status } = useCart();

  if (status === "loading" || status === "idle") {
    return <CartSkeleton />;
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
    return <CartEmpty />;
  }

  return (
    <div className="grid grid-cols-1 gap-lg lg:grid-cols-[1fr_320px] lg:items-start">
      <ul className="flex flex-col gap-lg">
        {cart.lines.map((line) => (
          <CartLineItem key={`${line.itemType}:${line.sku}`} line={line} cloudName={cloudName} />
        ))}
      </ul>

      <div className="order-first flex flex-col gap-lg lg:order-0 lg:sticky lg:top-16">
        <CartSummary cart={cart} />
        <CouponForm coupon={cart.coupon} />
      </div>
    </div>
  );
}
