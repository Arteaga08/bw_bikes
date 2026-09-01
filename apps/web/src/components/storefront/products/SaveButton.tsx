"use client";

import type { ItemType } from "@bw-bikes/shared";
import { Heart } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useWishlist } from "@/components/storefront/WishlistProvider";
import { Button, type ButtonTone } from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/use-async-action";
import { loginHref } from "@/lib/auth/customer-redirect";

export interface SaveButtonProps {
  itemType: ItemType;
  itemId: string;
  /** `"inverse"` on `CatalogProductCard`'s dark tile, default `"neutral"` on `ProductInfo`'s light buy rail. */
  tone?: ButtonTone;
  className?: string;
}

/**
 * The heart toggle — "Guardado para más tarde" (A5-guardados.md). Lives
 * inside `CatalogProductCard` (a `<Link>`) and `ProductInfo`, so its click
 * handler always stops propagation/default first: the heart must never
 * trigger the card's own navigation.
 *
 * Signed out, it sends the shopper to `/ingresar?redirect=…` instead of
 * calling the API — same pattern the cart's own add-to-cart button follows
 * (entrega B), via the same `loginHref`.
 */
export function SaveButton({ itemType, itemId, tone = "neutral", className }: SaveButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isSaved, toggle } = useWishlist();
  const saved = isSaved(itemType, itemId);

  const action = useAsyncAction(async () => {
    await toggle(itemType, itemId);
  });

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();

    if (isSignedIn === false) {
      router.push(loginHref(pathname));
      return;
    }

    action.run();
  }

  return (
    <Button
      type="button"
      variant="bare"
      size="icon"
      tone={tone}
      loading={action.pending}
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? "Quitar de guardados" : "Guardar para más tarde"}
      className={className}
    >
      <Heart weight={saved ? "fill" : "regular"} />
    </Button>
  );
}
