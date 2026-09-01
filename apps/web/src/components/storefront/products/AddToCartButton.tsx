"use client";

import type { ItemType } from "@bw-bikes/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/use-async-action";
import { ApiError } from "@/lib/api/error";
import { loginHref } from "@/lib/auth/customer-redirect";

export interface AddToCartButtonProps {
  itemType: ItemType;
  itemId: string;
  /** Absent while no valid variant is selected — the button reads that as "Selecciona una talla". */
  sku?: string;
  isSoldOut: boolean;
  productName: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/**
 * The real "Agregar al carrito" (`B-carrito.md` §4) — replaces the disabled
 * placeholder on both the PDP (`primary`, full width) and `RelatedAccessories`
 * (`ghost`, `sm`). Signed out, `CartProvider.addLine` rejects with a 401
 * `ApiError`; this button is what turns that into a redirect to
 * `/ingresar?redirect=…`, since the provider itself has no page to send
 * anyone back to.
 *
 * The `?sku=…&agregar=1` round trip: after login, the customer lands back on
 * the PDP with the same SKU pre-selected (`ProductInfo`'s `?sku=` read) and
 * this component fires the add exactly once (`firedReturnAdd` guards against
 * Strict Mode's double effect and any re-render), then strips the query so a
 * refresh doesn't repeat it.
 */
export function AddToCartButton({ itemType, itemId, sku, isSoldOut, productName, variant = "primary", size = "md", className }: AddToCartButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { addLine, openDrawer } = useCart();
  const firedReturnAdd = useRef(false);

  const add = useAsyncAction(async () => {
    if (!sku) return;
    try {
      await addLine(itemType, itemId, sku, 1);
      openDrawer();
    } catch (error) {
      if (error instanceof ApiError && error.httpStatus === 401) {
        const redirectTarget = `${pathname}?sku=${encodeURIComponent(sku)}&agregar=1`;
        router.push(loginHref(redirectTarget));
        return;
      }
      throw error;
    }
  });

  useEffect(() => {
    if (firedReturnAdd.current) return;
    if (searchParams.get("agregar") !== "1") return;
    const returnedSku = searchParams.get("sku");
    if (!returnedSku || returnedSku !== sku) return;

    firedReturnAdd.current = true;
    add.run();
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per mount, guarded by `firedReturnAdd`
  }, [searchParams, sku]);

  if (!sku) {
    return (
      <Button variant={variant} size={size} disabled title="Selecciona una talla" className={className}>
        Selecciona una talla
      </Button>
    );
  }

  if (isSoldOut) {
    return (
      <Button variant={variant} size={size} disabled title="Agotado" className={className}>
        Agotado
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      loading={add.pending}
      success={add.succeeded}
      successLabel="Agregado"
      onClick={add.run}
      aria-label={`Agregar al carrito: ${productName}`}
      className={className}
    >
      Agregar al carrito
    </Button>
  );
}
