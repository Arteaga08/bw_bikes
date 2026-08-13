/**
 * Mirrors `MAX_PRICE_CENTS` in
 * `apps/api/src/models/schemas/product-variant.schema.ts` — redeclared here
 * because `apps/web` never imports `apps/api` source (same reasoning as
 * `BULK_ALLOWED_STATUSES` in `lib/orders/status.ts`).
 */
export const MAX_PRICE_CENTS = 100_000_000;

/**
 * Parses a price input field's raw text (pesos, as the admin types it — with
 * or without a `$`, thousands commas, or decimals) into integer cents, the
 * only unit the API accepts. `null` means "not a valid price": empty, not a
 * number, negative, or over `MAX_PRICE_CENTS` — the form treats all four the
 * same way (blocks submit, shows the field's error).
 */
export function parsePriceToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strips `$`, spaces and thousands commas in one pass — anything that
  // isn't a digit, the decimal point, or a leading minus is noise the
  // admin's formatting added. The minus survives so a negative amount still
  // parses to a negative number and gets rejected below, instead of a typo
  // like "-5" silently becoming a valid $5.00.
  const cleaned = trimmed.replace(/[^0-9.-]/g, "");
  const pesos = Number.parseFloat(cleaned);
  if (!Number.isFinite(pesos) || pesos < 0) return null;

  const cents = Math.round(pesos * 100);
  return cents > MAX_PRICE_CENTS ? null : cents;
}

/** Integer cents → a plain, editable "19999.90" — two decimals, no `$`, no thousands separator. */
export function centsToPriceInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
