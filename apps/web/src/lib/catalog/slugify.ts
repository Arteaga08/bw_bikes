// Combining diacritical marks (U+0300–U+036F), written as escapes rather than
// literal characters so the intent survives any editor/encoding round-trip.
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const LEADING_TRAILING_HYPHENS = /^-+|-+$/g;
const MAX_SLUG_LENGTH = 120;

/**
 * Mirrors `apps/api/src/utils/slugify.ts` exactly — used here only to preview,
 * live, what the server will generate for a brand-new product or category
 * (`ProductBasicsSection`, `CategoryFormModal`). The server remains the only
 * one that actually assigns a slug; this never gets sent back as a value the
 * admin typed, so the two can't drift into different algorithms only where a
 * name happens to be edge-case-y (accents, `ñ`, repeated punctuation).
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .trim()
    .replace(NON_ALPHANUMERIC, "-")
    .replace(LEADING_TRAILING_HYPHENS, "")
    .slice(0, MAX_SLUG_LENGTH);
}
