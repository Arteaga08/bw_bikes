import { CURRENCY } from "@bw-bikes/shared";

const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: CURRENCY });
const compactCurrencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

/** `PriceCents` (integer cents, per `packages/shared`) → `"$25,000.00"`. */
export function formatCurrencyCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/**
 * `PriceCents` → `"$25k"` / `"$1.2M"`. For space-constrained labels only —
 * a chart's y-axis gridlines — never for a headline figure a merchant is
 * expected to trust down to the peso.
 */
export function formatCompactCurrencyCents(cents: number): string {
  return compactCurrencyFormatter.format(cents / 100);
}

/**
 * Same as `formatCurrencyCents`, with the currency spelled out — `"$25,000.00 MXN"`.
 * `es-MX`'s symbol form never shows the code, so list views that need the
 * currency to never be implicit append it themselves rather than switching
 * every money display in the app to `currencyDisplay: "code"`.
 */
export function formatCurrencyCentsWithCurrency(cents: number): string {
  return `${formatCurrencyCents(cents)} ${CURRENCY}`;
}
