import type { SettingsSections, ThreeDSecurePolicy } from "@bw-bikes/shared";

/**
 * Defaults for the `Settings` singleton (M7). Every constant here used to
 * live in `config/env.ts` with the exact same value and the exact same
 * reasoning in its comment — moved, not reinvented, so a deploy that has
 * never touched the admin panel behaves identically to the M4–M6 env-driven
 * behaviour. This is the **only** place these numbers are hardcoded: the
 * model's schema defaults and the service's lazy-upsert both import from
 * here, so there is one number per threshold, not two that can drift apart.
 *
 * `STRIPE_WEBHOOK_TOLERANCE_SECONDS` is deliberately absent — it is a
 * security control (signature replay window), not a business rule the owner
 * tunes, and stays in `config/env.ts`.
 */

/** How long a checkout may hold stock before the expiry job takes it back. */
export const DEFAULT_RESERVATION_TTL_MINUTES = 30;

/** How long a finished reservation is kept for forensics before Mongo's TTL drops it. */
export const DEFAULT_RESERVATION_RETENTION_DAYS = 30;

/**
 * Store-wide low-stock cutoff (M11) — moved here from a private constant in
 * `services/stats/inventory.stats.ts` so the owner can tune it without a
 * redeploy, same reasoning as every other threshold in this file. Same value
 * as the constant it replaces, so a deploy that has never touched the admin
 * panel keeps behaving identically.
 */
export const DEFAULT_LOW_STOCK_THRESHOLD_UNITS = 5;

/**
 * How long an order may sit in `pending_payment` holding stock while the
 * customer completes the payment form. Shorter than the generic reservation
 * TTL on purpose — see `order.service.ts`'s `createFromCart`.
 */
export const DEFAULT_ORDER_PAYMENT_TTL_MINUTES = 15;

/**
 * Stripe drops an uncaptured authorization after about 7 days. Warn the
 * admin on day 5, cancel ourselves on day 6.5 — deliberately before Stripe's
 * own deadline, so the release and the customer notice happen at a moment
 * the shop chose.
 */
export const DEFAULT_ORDER_AUTH_ALERT_HOURS = 120;
export const DEFAULT_ORDER_AUTH_CANCEL_HOURS = 156;

/** Grace period before an unresolved `pending_payment` order is worth reconciling with the gateway. */
export const DEFAULT_PAYMENT_RECONCILIATION_AFTER_MINUTES = 20;

/**
 * `"automatic"` matches Stripe's own default — its risk engine decides
 * whether a given card payment needs a 3D Secure challenge. Selling
 * high-value bikes is exactly the case the admin might want to tighten this
 * to `"any"` (force a challenge on every payment) without a redeploy, which is
 * why it lives in `Settings` rather than being a constant in the provider.
 */
export const DEFAULT_REQUEST_THREE_D_SECURE: ThreeDSecurePolicy = "automatic";

/**
 * IVA in basis points, used **only** to break the tax out of a total that
 * already contains it (Mexican B2C prices are quoted IVA-included). Never
 * adds to what is charged: `tax = round(total × bps / (10000 + bps))`.
 */
export const DEFAULT_TAX_RATE_BPS = 1600;

/**
 * Closes design-spec open decision #1: a bike's own price already clears the
 * free-shipping threshold, so there is no separate "bikes ship free" rule —
 * the arithmetic in `shipping.service.ts` just always lands on free for them.
 */
export const DEFAULT_SHIPPING_ACCESSORY_FLAT_CENTS = 25_000;
export const DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS = 200_000;

/**
 * How long a rejected ambassador/sponsorship applicant must wait before
 * reapplying. An approved applicant never reapplies at all; a pending one is
 * blocked by the partial unique index, not this value.
 */
export const DEFAULT_APPLICATION_COOLDOWN_DAYS = 90;

/** How often the reservation reaper, authorization sweeper and reconciliation job tick. */
export const DEFAULT_REAPER_INTERVAL_MS = 60_000;
export const DEFAULT_ORDER_AUTH_SWEEP_INTERVAL_MS = 300_000;
export const DEFAULT_PAYMENT_RECONCILIATION_INTERVAL_MS = 600_000;

/** How often the low-stock sweep ticks — same order of magnitude as the authorization sweeper. */
export const DEFAULT_LOW_STOCK_ALERT_INTERVAL_MS = 300_000;

export const SETTINGS_DEFAULTS: SettingsSections = Object.freeze({
  inventory: Object.freeze({
    stockReservationTtlMinutes: DEFAULT_RESERVATION_TTL_MINUTES,
    reservationRetentionDays: DEFAULT_RESERVATION_RETENTION_DAYS,
    lowStockThresholdUnits: DEFAULT_LOW_STOCK_THRESHOLD_UNITS,
  }),
  orders: Object.freeze({
    orderPaymentTtlMinutes: DEFAULT_ORDER_PAYMENT_TTL_MINUTES,
    orderAuthAlertHours: DEFAULT_ORDER_AUTH_ALERT_HOURS,
    orderAuthCancelHours: DEFAULT_ORDER_AUTH_CANCEL_HOURS,
    paymentReconciliationAfterMinutes: DEFAULT_PAYMENT_RECONCILIATION_AFTER_MINUTES,
    requestThreeDSecure: DEFAULT_REQUEST_THREE_D_SECURE,
  }),
  pricing: Object.freeze({ taxRateBps: DEFAULT_TAX_RATE_BPS }),
  shipping: Object.freeze({
    accessoryFlatCents: DEFAULT_SHIPPING_ACCESSORY_FLAT_CENTS,
    freeShippingThresholdCents: DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS,
  }),
  applications: Object.freeze({ cooldownDays: DEFAULT_APPLICATION_COOLDOWN_DAYS }),
  jobs: Object.freeze({
    reservationReaperIntervalMs: DEFAULT_REAPER_INTERVAL_MS,
    orderAuthSweepIntervalMs: DEFAULT_ORDER_AUTH_SWEEP_INTERVAL_MS,
    paymentReconciliationIntervalMs: DEFAULT_PAYMENT_RECONCILIATION_INTERVAL_MS,
    lowStockAlertIntervalMs: DEFAULT_LOW_STOCK_ALERT_INTERVAL_MS,
  }),
});
