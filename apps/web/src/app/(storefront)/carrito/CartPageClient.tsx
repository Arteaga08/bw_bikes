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
import { FreeShippingBanner } from "@/components/cart/FreeShippingBanner";

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

  const lineCount = cart.lines.reduce((total, line) => total + line.qty, 0);

  return (
    <div className="flex flex-col gap-md">
      <p className="font-body text-caption text-grafito">{lineCount === 1 ? "1 artículo" : `${lineCount} artículos`}</p>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-[1fr_21rem] lg:items-start">
        <div className="flex flex-col gap-lg">
          {cart.shippingCents === 0 ? <FreeShippingBanner /> : null}

          <ul className="flex flex-col gap-lg rounded-card-lg border border-borde bg-surface p-lg">
            {cart.lines.map((line) => (
              <CartLineItem key={`${line.itemType}:${line.sku}`} line={line} cloudName={cloudName} />
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-lg lg:sticky lg:top-[88px]">
          <CartSummary cart={cart} />
          <CouponForm coupon={cart.coupon} />
        </div>
      </div>
    </div>
  );
}
