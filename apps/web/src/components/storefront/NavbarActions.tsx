import { MagnifyingGlass, ShoppingCart, User } from "@phosphor-icons/react/ssr";
import { Button, type ButtonTone } from "@/components/ui/Button";

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
 * Buscar / Cuenta / Carrito. All three are visual placeholders in this
 * entrega: search opens once the catalog exists (a later entrega), and
 * Cuenta/Carrito are M13. Rendered `disabled` — not omitted — so the bar
 * already has its final proportions; M13 only swaps each `Button` for a
 * real control, no re-layout. The count in "Carrito (0)" mirrors the
 * mockup's "Carrito (0)" and moves once M13 wires up a real cart.
 *
 * Buscar and Cuenta hide below `md`: four 44px squares plus the wordmark
 * don't fit a 390px phone without overflowing (verified — they pushed
 * Carrito and the hamburger off-screen). Carrito stays, as the one
 * persistent affordance shoppers expect on mobile; the other two are
 * reachable once they actually do something (Buscar with the catalog,
 * Cuenta once M13 exists) rather than crowding a screen this narrow with
 * three controls that do nothing yet.
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
 * where every hover (links included) turns gold. Overriding it needs the
 * same care as the two cases above, plus one more wrinkle: these controls
 * are `disabled`, and `disabled:text-*` is a same-specificity sibling of
 * `hover:*` that Tailwind's default variant order puts *after* it — so a
 * plain `hover:text-dorado` would lose to the disabled color, not just to
 * `bare`'s own built-in hover. `!` (important) is the one thing that
 * deterministically wins over both without touching `Button.tsx` — which
 * would ripple into every other `bare`/`neutral` control in the admin panel
 * that relies on today's negro hover. Scoped here, on purpose: the color is
 * cosmetic only, `disabled` still blocks the click and pulls it out of tab
 * order — nothing about the control's actual inertness changes.
 */
export function NavbarActions({ tone }: NavbarActionsProps) {
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
      <Button
        variant="bare"
        tone={tone}
        size="icon-lg"
        disabled
        aria-label="Cuenta"
        title="Disponible próximamente"
        iconLeft={<User style={{ width: ICON_SIZE, height: ICON_SIZE }} />}
        className="max-md:hidden hover:!text-dorado"
      />
      <Button
        variant="bare"
        tone={tone}
        size="icon-lg"
        disabled
        aria-label="Carrito (0)"
        title="Disponible próximamente"
        iconLeft={<ShoppingCart style={{ width: ICON_SIZE, height: ICON_SIZE }} />}
        className="hover:!text-dorado"
      />
    </div>
  );
}
