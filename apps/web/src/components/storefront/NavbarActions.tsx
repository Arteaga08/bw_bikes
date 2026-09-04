"use client";

import { ShoppingCart, User } from "@phosphor-icons/react";
import { useCart } from "@/components/cart/CartProvider";
import { SearchDropdown } from "@/components/storefront/SearchDropdown";
import { Button, type ButtonTone } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ACCOUNT_PATH } from "@/lib/config";

export interface NavbarActionsProps {
  /** Follows the navbar's own transparent/solid state — `inverse` over the hero, `neutral` once scrolled. */
  tone: ButtonTone;
}

/**
 * `icon-lg`'s glyph is fixed at 20px via `Button`'s own `ICON_SLOT_CLASSES`
 * (`[&>svg]:h-5 [&>svg]:w-5`, applied to the wrapping span *inside*
 * `ButtonContent`, not something a caller's `className` can reach). Bumping
 * it up here has to go through an inline `style` on the glyph itself —
 * inline styles win over any external stylesheet rule targeting the same
 * element, `!important` or not, so this is the one lever that doesn't
 * depend on generated-CSS order at all. 28px keeps the icon inside the 44px
 * box with 8px of breathing room on each side.
 */
const ICON_SIZE = 28;

/**
 * Buscar / Cuenta / Carrito. Buscar now opens `SearchDropdown` (which owns
 * its own toggle button, styled to match Cuenta/Carrito's). Cuenta became a
 * real link in M13 A1 — it goes straight to `ACCOUNT_PATH` (`/mi-cuenta`),
 * which A2's own guard redirects to `/ingresar` for an anonymous visitor.
 * Carrito opens the cart drawer via `useCart`. The count in "Carrito (0)"
 * mirrors the mockup's "Carrito (0)".
 *
 * Buscar hides below `md`: four 44px squares plus the wordmark don't fit a
 * 390px phone without overflowing (verified — they pushed Carrito and the
 * hamburger off-screen). Carrito stays, as the one persistent affordance
 * shoppers expect on mobile; Cuenta and Buscar have no mobile entry point
 * yet. For Buscar this is deliberate for now (Manuel's call) — mobile search
 * is a separate, later piece of work, not part of this pass.
 *
 * `max-md:hidden`, not bare `hidden md:inline-flex`: `Button`'s own
 * `CONTROL_CLASSES` already bakes in an unconditional `inline-flex`, so a
 * bare `hidden` alongside it is two unprefixed utilities fighting over
 * `display` on the same element with nothing to break the tie — exactly the
 * "generated-CSS order, not string order" trap `lib/cn.ts` documents.
 * Confirmed by rendering at 390px: the bare version silently lost and the
 * buttons stayed visible, overflowing Carrito and the hamburger off-screen.
 * `max-md:` is a media-scoped variant, so it always wins below `md` — no
 * unprefixed pair to arbitrate.
 *
 * `hover:!text-dorado`: `bare`'s `neutral` tone hovers to `text-negro`, not
 * gold — correct for the admin's row actions, wrong for this storefront nav,
 * where every hover (links included) turns gold. `!` (important) is what
 * deterministically wins over `bare`'s own built-in hover without touching
 * `Button.tsx` — which would ripple into every other `bare`/`neutral`
 * control in the admin panel that relies on today's negro hover.
 */
export function NavbarActions({ tone }: NavbarActionsProps) {
  const { lineCount, openDrawer } = useCart();

  return (
    <div className="flex items-center gap-xs">
      <SearchDropdown tone={tone} />
      <ButtonLink
        href={ACCOUNT_PATH}
        variant="bare"
        tone={tone}
        size="icon-lg"
        aria-label="Cuenta"
        iconLeft={<User style={{ width: ICON_SIZE, height: ICON_SIZE }} />}
        className="hover:!text-dorado"
      />
      <Button
        variant="bare"
        tone={tone}
        size="icon-lg"
        onClick={openDrawer}
        aria-label={`Carrito (${lineCount})`}
        iconLeft={
          <span className="relative inline-flex">
            <ShoppingCart style={{ width: ICON_SIZE, height: ICON_SIZE }} />
            {lineCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-dorado px-1 font-ui text-[10px] leading-none text-negro"
              >
                {lineCount}
              </span>
            ) : null}
          </span>
        }
        className="hover:!text-dorado"
      />
    </div>
  );
}
