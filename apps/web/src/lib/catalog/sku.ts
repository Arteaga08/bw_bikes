// Combining diacritical marks (U+0300–U+036F), written as escapes rather than
// literal characters so the intent survives any editor/encoding round-trip.
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^A-Z0-9]/g;
const TRAILING_HYPHENS = /-+$/;

/** Mirrors `MAX_SKU_LENGTH` in `apps/api/src/models/schemas/product-variant.schema.ts`. */
const MAX_SKU_LENGTH = 40;

const BRAND_TOKEN_LENGTH = 3;
const MODEL_TOKEN_LENGTH = 6;
const COLOR_TOKEN_LENGTH = 3;
const WORD_TRUNCATE_LENGTH = 3;
const SHORT_WORD_LENGTH = 2;

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(NON_ALPHANUMERIC, "");
}

function brandToken(brandName: string): string {
  const firstWord = brandName.trim().split(/\s+/)[0] ?? "";
  return normalizeToken(firstWord).slice(0, BRAND_TOKEN_LENGTH);
}

/** Short/numeric words ("SL", "5", "XT") already carry their full meaning in a couple of characters — truncating them further would erase the signal, so only longer words get shortened. */
function modelToken(productName: string, brandName: string): string {
  let words = productName.trim().split(/\s+/).filter(Boolean);
  const firstBrandWord = brandName.trim().split(/\s+/)[0]?.toLowerCase();
  if (words[0]?.toLowerCase() === firstBrandWord) {
    words = words.slice(1);
  }

  const tokens = words.map((word) => {
    const normalized = normalizeToken(word);
    return normalized.length <= SHORT_WORD_LENGTH ? normalized : normalized.slice(0, WORD_TRUNCATE_LENGTH);
  });

  return tokens.join("").slice(0, MODEL_TOKEN_LENGTH);
}

function sizeToken(size: string): string {
  return normalizeToken(size.trim());
}

function colorToken(color: string): string {
  const firstWord = color.trim().split(/\s+/)[0] ?? "";
  return normalizeToken(firstWord).slice(0, COLOR_TOKEN_LENGTH);
}

/**
 * Deterministic SKU built from Brand + Model + Size + Color, abbreviated —
 * e.g. `buildSkuBase("Trek", "Domane SL 5", "54", "Negro")` → `"TRE-DOMSL5-54-NEG"`.
 * Blank size/color are simply omitted, never left as an empty segment.
 */
export function buildSkuBase(brandName: string, productName: string, size: string, color: string): string {
  const parts = [brandToken(brandName), modelToken(productName, brandName), sizeToken(size), colorToken(color)].filter(
    Boolean,
  );

  return parts.join("-").slice(0, MAX_SKU_LENGTH).replace(TRAILING_HYPHENS, "");
}

/** Appends `-2`, `-3`, ... until `base` no longer collides with `takenSkus` — collisions here are scoped to the sibling rows already in the same form, since cross-product uniqueness is enforced server-side. */
export function ensureUniqueSku(base: string, takenSkus: ReadonlySet<string>): string {
  if (!base || !takenSkus.has(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix++) {
    const suffixText = `-${suffix}`;
    const candidate = `${base.slice(0, MAX_SKU_LENGTH - suffixText.length)}${suffixText}`;
    if (!takenSkus.has(candidate)) return candidate;
  }

  return base;
}
