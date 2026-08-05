import type { Carrier, OrderLineSnapshot, ShippingSettings } from "@bw-bikes/shared";
import {
  DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
  DEFAULT_SHIPPING_ACCESSORY_FLAT_CENTS,
} from "../config/settings.defaults.js";

/**
 * Closes open decision #1 (shipping cost). A narrow interface — `quote` takes
 * only the line data it needs and returns cents — so the rule can change
 * (zones, an aggregator) without touching `order.service.ts` or `cart.service.ts`.
 *
 * ## The rule
 *
 * A single threshold, no bike-specific exception:
 *
 *   subtotal >= freeShippingThresholdCents  ->  free
 *   otherwise                               ->  accessoryFlatCents
 *
 * A bike's own price ($80k–$300k MXN per the spec) already clears the
 * threshold on its own, so "bikes ship free" is not a rule this file encodes —
 * it is simply what the arithmetic always produces for a bike. That is also
 * why this function needs nothing from the catalog or the category trees:
 * every line already carries its own `lineTotalCents` in the snapshot.
 *
 * `thresholds` is a **parameter, not a read from `Settings` in here** — this
 * stays a pure function, callable in isolation (as the tests do), and the
 * two real callers (`cart.service.ts`, `order.service.ts`) fetch `Settings`
 * once per request and pass the live values down. The default below exists
 * only so an isolated call is still meaningful without wiring `Settings`.
 */
export interface ShippingQuote {
  shippingCents: number;
  isFree: boolean;
}

const DEFAULT_THRESHOLDS: ShippingSettings = {
  accessoryFlatCents: DEFAULT_SHIPPING_ACCESSORY_FLAT_CENTS,
  freeShippingThresholdCents: DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
};

function quote(
  lines: Pick<OrderLineSnapshot, "lineTotalCents">[],
  thresholds: ShippingSettings = DEFAULT_THRESHOLDS,
): ShippingQuote {
  // Nothing to ship is not the same as an order under the threshold — an
  // empty cart preview must not show a shipping fee for a purchase that
  // doesn't exist yet.
  if (lines.length === 0) {
    return { shippingCents: 0, isFree: true };
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

  if (subtotalCents >= thresholds.freeShippingThresholdCents) {
    return { shippingCents: 0, isFree: true };
  }

  return { shippingCents: thresholds.accessoryFlatCents, isFree: false };
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
