import { Lock } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";

/**
 * The checkout's own reduced chrome — 64px, same height as `Navbar`, but
 * with none of its links, search, cart button, or account menu.
 * `DESIGN_SYSTEM.md:325,350`: checkout is the one screen in the site with
 * zero rinoceronte appearances and no footer — a conversion screen, not a
 * browsing one.
 */
export function CheckoutHeader() {
  return (
    <div className="flex h-16 items-center justify-between border-b border-borde bg-surface px-lg">
      <ButtonLink href="/carrito" variant="text" size="sm">
        ← Volver al carrito
      </ButtonLink>
      <p className="font-display text-h3 text-negro">Black and White Bikes</p>
      <div className="flex items-center gap-xs font-body text-caption text-grafito">
        <Lock size={14} weight="regular" aria-hidden="true" />
        Pago seguro
      </div>
    </div>
  );
}
