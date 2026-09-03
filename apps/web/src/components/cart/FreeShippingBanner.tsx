import { CheckCircle } from "@phosphor-icons/react/ssr";

/**
 * Shown only when `cart.shippingCents === 0` — the cart already qualifies.
 * There is no "te faltan $X para envío gratis" progress state: the threshold
 * (`freeShippingThresholdCents`, M7) lives only behind `/admin/settings` and
 * `PublicCart` doesn't expose it, so a remaining-amount message would either
 * be invented or drift the moment the owner edits it in the admin panel.
 */
export function FreeShippingBanner() {
  return (
    <p className="flex items-center gap-sm rounded-control bg-estado-exito-soft px-md py-sm font-body text-caption text-estado-exito">
      <CheckCircle size={16} weight="fill" aria-hidden="true" className="shrink-0" />
      Calificaste para envío gratis.
    </p>
  );
}
