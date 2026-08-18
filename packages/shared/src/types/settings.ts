/**
 * The `Settings` singleton (M7): every business threshold that used to live in
 * an environment variable with a hardcoded default (M4/M5/M6) so the owner can
 * change it from the admin panel without a redeploy
 * (`ECOMMERCE_ARCHITECTURE_GUIDELINES.md`).
 *
 * Grouped into **sections**, because the document is edited by section —
 * `PUT /admin/settings/:section` replaces one section's fields in one atomic
 * `$set`, never the whole document. That is what makes "editing shipping
 * can't clobber orders" a structural property instead of a promise: two
 * admins editing two different sections at the same time cannot race each
 * other, because their writes touch disjoint paths.
 */

/**
 * How long a checkout may hold stock, how long a finished hold is kept for
 * forensics, and the store-wide low-stock cutoff (M11) — the number of units
 * at or below which a SKU surfaces on the inventory panel's reorder list. A
 * single `InventoryItem` may override this with its own `lowStockThreshold`
 * (a bike worth reordering at 3 units, an accessory at 20); this is the
 * fallback everything else uses.
 */
export interface InventorySettings {
  stockReservationTtlMinutes: number;
  reservationRetentionDays: number;
  lowStockThresholdUnits: number;
}

/**
 * The order lifecycle's four clocks: how long a `pending_payment` order may
 * hold stock while the customer pays, when to warn the admin about an
 * expiring authorization, when to cancel it ourselves, and the grace period
 * before an unresolved payment is worth reconciling with the gateway.
 *
 * `orderAuthAlertHours` must stay lower than `orderAuthCancelHours` — warning
 * the admin *after* the authorization was already cancelled would make the
 * alert useless. Enforced in the model, not only in the validator, because
 * the value no longer arrives exclusively through HTTP once it lives here.
 */
/**
 * The gateway's 3D Secure challenge policy for a checkout's PaymentIntent.
 * `"automatic"` (Stripe's own default) lets its risk engine decide whether to
 * challenge; `"any"` forces a challenge on every card payment regardless of
 * risk score. Not a security control this codebase can weaken by omission —
 * requesting 3DS at all is what shifts chargeback liability to the card
 * issuer, so the field exists precisely so the owner can tighten it (e.g. to
 * `"any"`) for a catalog of high-value goods without a redeploy.
 */
export type ThreeDSecurePolicy = "automatic" | "any";

export interface OrdersSettings {
  orderPaymentTtlMinutes: number;
  orderAuthAlertHours: number;
  orderAuthCancelHours: number;
  paymentReconciliationAfterMinutes: number;
  requestThreeDSecure: ThreeDSecurePolicy;
}

/** IVA in basis points, used only to break the tax out of a total that already contains it. */
export interface PricingSettings {
  taxRateBps: number;
}

/**
 * Closes design-spec open decision #1. `freeShippingThresholdCents` is the
 * subtotal at which shipping becomes free; below it, every order pays
 * `accessoryFlatCents`. No separate "bikes ship free" rule exists — a bike's
 * own price already clears the threshold on its own.
 */
export interface ShippingSettings {
  accessoryFlatCents: number;
  freeShippingThresholdCents: number;
}

/** How long a rejected ambassador/sponsorship applicant must wait before reapplying. */
export interface ApplicationsSettings {
  cooldownDays: number;
}

/**
 * How often each background sweep ticks. Distinct from the other sections
 * because it tunes the *process*, not a business rule about money or stock —
 * but the owner still shouldn't need a redeploy to make the reaper tick
 * faster while diagnosing an issue.
 */
export interface JobsSettings {
  reservationReaperIntervalMs: number;
  orderAuthSweepIntervalMs: number;
  paymentReconciliationIntervalMs: number;
}

export interface SettingsSections {
  inventory: InventorySettings;
  orders: OrdersSettings;
  pricing: PricingSettings;
  shipping: ShippingSettings;
  applications: ApplicationsSettings;
  jobs: JobsSettings;
}

/** Every section name, in the order the admin panel groups them. */
export const SETTINGS_SECTIONS = [
  "inventory",
  "orders",
  "pricing",
  "shipping",
  "applications",
  "jobs",
] as const satisfies readonly (keyof SettingsSections)[];

export type SettingsSectionName = (typeof SETTINGS_SECTIONS)[number];

/** The full document, as `GET /admin/settings` returns it. */
export interface AdminSettings extends SettingsSections {
  updatedAt: string;
}
