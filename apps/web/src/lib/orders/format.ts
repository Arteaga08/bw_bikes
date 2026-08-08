const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** `PriceCents` (integer cents, per `packages/shared`) → `"$25,000.00"`. */
export function formatCurrencyCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/** An ISO timestamp from the API → a locale-formatted date+time string. */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
