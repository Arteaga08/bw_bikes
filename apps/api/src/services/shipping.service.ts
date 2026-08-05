import type { Carrier, OrderLineSnapshot } from "@bw-bikes/shared";
import { env } from "../config/env.js";

/**
 * Closes open decision #1 (shipping cost). A narrow interface — `quote` takes
 * only the line data it needs and returns cents — so the rule can change
 * (zones, an aggregator) without touching `order.service.ts` or `cart.service.ts`.
 *
 * ## The rule
 *
 * A single threshold, no bike-specific exception:
 *
 *   subtotal >= FREE_SHIPPING_THRESHOLD_CENTS  ->  free
 *   otherwise                                  ->  SHIPPING_ACCESSORY_FLAT_CENTS
 *
 * A bike's own price ($80k–$300k MXN per the spec) already clears the
 * threshold on its own, so "bikes ship free" is not a rule this file encodes —
 * it is simply what the arithmetic always produces for a bike. That is also
 * why this function needs nothing from the catalog or the category trees:
 * every line already carries its own `lineTotalCents` in the snapshot.
 */
export interface ShippingQuote {
  shippingCents: number;
  isFree: boolean;
}

function quote(lines: Pick<OrderLineSnapshot, "lineTotalCents">[]): ShippingQuote {
  // Nothing to ship is not the same as an order under the threshold — an
  // empty cart preview must not show a shipping fee for a purchase that
  // doesn't exist yet.
  if (lines.length === 0) {
    return { shippingCents: 0, isFree: true };
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

  if (subtotalCents >= env.freeShippingThresholdCents) {
    return { shippingCents: 0, isFree: true };
  }

  return { shippingCents: env.shippingAccessoryFlatCents, isFree: false };
}

/**
 * Best-effort tracking URL from a carrier + guide number, for the common
 * case where the admin only has the number at hand. `"otro"` has no template
 * on purpose — an unlisted carrier's URL format isn't ours to guess, so the
 * caller (the shipment validator) requires it explicitly instead.
 */
const CARRIER_TRACKING_URL_BUILDERS: Partial<Record<Carrier, (trackingNumber: string) => string>> = {
  dhl: (n) => `https://www.dhl.com/mx-es/home/tracking/tracking-express.html?tracking-id=${encodeURIComponent(n)}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  estafeta: (n) => `https://rastreo.estafeta.com/Rastreo/webForm.aspx?guias=${encodeURIComponent(n)}`,
  paquetexpress: (n) => `https://www.paquetexpress.com.mx/rastreo-de-envio?guia=${encodeURIComponent(n)}`,
  redpack: (n) => `https://www.redpack.com.mx/rastreo/?guia=${encodeURIComponent(n)}`,
  ups: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
};

function buildTrackingUrl(carrier: Carrier, trackingNumber: string): string | undefined {
  return CARRIER_TRACKING_URL_BUILDERS[carrier]?.(trackingNumber);
}

export const shippingService = { quote, buildTrackingUrl };
