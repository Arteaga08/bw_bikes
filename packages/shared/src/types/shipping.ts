/**
 * The 32 Mexican federal entities, as a closed list rather than free text —
 * the storefront renders it as a `<select>` and the admin panel can group by
 * it without normalizing typos ("Edo. Mex." vs "Estado de México").
 */
export const MEXICAN_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "México",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
] as const;

export type MexicanState = (typeof MEXICAN_STATES)[number];

/**
 * Where an order ships. Captured by the customer on the cart before checkout
 * (see `PublicCart.shippingAddress` / `PUT /cart/shipping-address`) and copied
 * onto the order as a snapshot at checkout time, same reasoning as
 * `OrderLineSnapshot`: an address the customer edits later must not silently
 * rewrite where an already-placed order was told to go.
 */
export interface ShippingAddress {
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  interiorNumber?: string;
  neighborhood: string;
  city: string;
  state: MexicanState;
  postalCode: string;
  /** Fixed: the shop only ships within Mexico today. Kept explicit for when that changes. */
  country: "MX";
  references?: string;
}

/** Couriers the shop hands packages to. `"otro"` covers anything else, with its own name required. */
export type Carrier = "dhl" | "fedex" | "estafeta" | "paquetexpress" | "redpack" | "ups" | "otro";

/**
 * Tracking facts captured once an order leaves the warehouse. Present only
 * from `shipped` onward — an order in `processing` has no shipment yet.
 */
export interface ShipmentSummary {
  carrier: Carrier;
  /** Required (and free text) only when `carrier` is `"otro"`. */
  carrierName?: string;
  trackingNumber: string;
  trackingUrl: string;
  shippedAt: string;
}
