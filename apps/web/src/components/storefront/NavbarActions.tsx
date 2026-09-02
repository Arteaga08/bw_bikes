"use client";

import { MagnifyingGlass, ShoppingCart, User } from "@phosphor-icons/react";
import { useCart } from "@/components/cart/CartProvider";
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
 * Buscar / Cuenta / Carrito. Buscar and Carrito are visual placeholders
 * still: search opens once the catalog exists (a later entrega), and
 * Carrito is M13's entrega B. Cuenta became a real link in M13 A1 — it goes
 * straight to `ACCOUNT_PATH` (`/mi-cuenta`), which A2's own guard redirects
 * to `/ingresar` for an anonymous visitor. Buscar/Carrito stay `disabled` —
 * not omitted — so the bar keeps its final proportions until each one is
 * wired up in turn, no re-layout when they are. The count in "Carrito (0)"
 * mirrors the mockup's "Carrito (0)" and moves once M13 wires up a real
 * cart.
 *
 * Buscar and Cuenta hide below `md`: four 44px squares plus the wordmark
 * don't fit a 390px phone without overflowing (verified — they pushed
 * Carrito and the hamburger off-screen). Carrito stays, as the one
 * persistent affordance shoppers expect on mobile; the other two are
 * reachable once they actually do something (Buscar with the catalog,
 * Cuenta now that it links to `/mi-cuenta`) rather than crowding a screen
 * this narrow with three controls, two of which still do nothing.
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
 *
 * Buscar and Carrito still carry a *second* reason for the `!`: they're
 * `disabled`, and `disabled:text-*` is a same-specificity sibling of
 * `hover:*` that Tailwind's default variant order puts *after* it — a plain
 * `hover:text-dorado` would lose to the disabled color, not just to `bare`'s
 * own hover. Cuenta is a `ButtonLink` now, not `disabled`, so only the first
 * reason still applies there — but it's still one real reason, so the `!`
 * stays on all three.
 */
export function NavbarActions({ tone }: NavbarActionsProps) {
  const { lineCount, openDrawer } = useCart();

  return (
    <div className="flex items-center gap-xs">
      <Button
        variant="bare"
        tone={tone}
        size="icon-lg"
        disabled
        aria-label="Buscar"
        title="Disponible próximamente"
        iconLeft={<MagnifyingGlass style={{ width: ICON_SIZE, height: ICON_SIZE }} />}
        className="max-md:hidden hover:!text-dorado"
      />
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
