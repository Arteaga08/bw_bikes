// Combining diacritical marks (U+0300–U+036F). Written as escapes rather than
// literal characters so the intent survives any editor/encoding round-trip.
const COMBINING_MARKS = /[\u0300-\u036f]/g;

const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const LEADING_TRAILING_HYPHENS = /^-+|-+$/g;

const MAX_SLUG_LENGTH = 120;

/**
 * URL-safe slug from a human name, written here rather than pulled from a
 * dependency because the only hard requirement is Spanish: "Bicicletas de
 * Montaña" has to become `bicicletas-de-montana`, not `bicicletas-de-monta-a`.
 *
 * NFD splits an accented character into base letter + combining mark, so
 * stripping the combining range leaves the plain letter behind. `ñ`, `á` and
 * `ü` all fall out of that same pass.
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
