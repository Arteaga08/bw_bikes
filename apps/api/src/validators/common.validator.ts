import Joi from "joi";
import { MAX_PRICE_CENTS, MAX_SKU_LENGTH } from "../models/index.js";

/**
 * Field-level schemas shared by every catalog validator, so all of them agree
 * on shape and on message copy. Same approach as `auth.validator.ts` — the
 * user-facing strings live in Spanish, the code around them in English.
 */

/** A 24-char hex Mongo ObjectId. Validating the shape here turns a would-be CastError into a clean 400. */
export const objectId = Joi.string()
  .trim()
  .pattern(/^[a-f0-9]{24}$/)
  .messages({
    "string.empty": "El identificador es obligatorio.",
    "string.pattern.base": "Identificador inválido.",
    "any.required": "El identificador es obligatorio.",
  });

/**
 * A comma-separated list of ObjectIds — the multi-select shape for a filter
 * like `?category=<id>,<id>`. Capped at 10: a shopper picking more root
 * categories than that on one filter bar isn't a real case worth a larger
 * `$in`.
 */
export const objectIdList = Joi.string()
  .trim()
  .pattern(/^[a-f0-9]{24}(,[a-f0-9]{24}){0,9}$/)
  .messages({
    "string.empty": "El identificador es obligatorio.",
    "string.pattern.base": "Identificador inválido.",
  });

/**
 * A comma-separated list drawn from a closed set — the "one filter, several
 * values" shape (`?status=paid,processing`) that a grouped filter chip needs
 * and a single `Joi.valid(...)` can't express.
 *
 * Returns the **parsed array**, so the service reads `string[]` and never
 * re-splits the raw string itself (the ad-hoc `splitList` in
 * `product.service.ts` is what this replaces for new callers). Duplicates
 * collapse and order is irrelevant — the value feeds a Mongo `$in`. `allowed`
 * doubles as the length ceiling, so repeating a valid member can't force an
 * oversized `$in`.
 *
 * Chain `.messages({ "any.invalid": "..." })` at the call site to name the
 * field in the error the way every other schema here does.
 */
export function commaListOf<T extends string>(allowed: readonly T[]): Joi.StringSchema {
  const permitted: readonly string[] = allowed;
  return Joi.string()
    .trim()
    .custom((value: string, helpers) => {
      const parts = [...new Set(value.split(",").map((part) => part.trim()).filter((part) => part !== ""))];
      if (parts.length === 0 || parts.length > permitted.length) return helpers.error("any.invalid");
      if (parts.some((part) => !permitted.includes(part))) return helpers.error("any.invalid");
      return parts;
    })
    .messages({ "any.invalid": "El valor del filtro no es válido." });
}

/** Lowercase, hyphen-separated, no leading/trailing/double hyphens. Matches `slugify()`'s output. */
export const slug = Joi.string()
  .trim()
  .lowercase()
  .max(120)
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .messages({
    "string.empty": "El slug es obligatorio.",
    "string.max": "El slug no puede exceder 120 caracteres.",
    "string.pattern.base": "El slug solo admite minúsculas, números y guiones.",
    "any.required": "El slug es obligatorio.",
  });

/**
 * Money is always an integer number of cents. Rejecting a float here is what
 * keeps a price of `1999.99` from ever being interpreted as $19.99 downstream.
 */
export const priceCents = Joi.number().integer().min(0).max(MAX_PRICE_CENTS).messages({
  "number.base": "El precio debe ser un número.",
  "number.integer": "El precio debe expresarse en centavos, sin decimales.",
  "number.min": "El precio no puede ser negativo.",
  "number.max": "El precio excede el máximo permitido.",
  "any.required": "El precio es obligatorio.",
});

/**
 * A variant's stock-keeping unit. Uppercased so `bk-tarmac-m` and
 * `BK-TARMAC-M` can't coexist as two codes the warehouse would read as one.
 * Shared between the catalog validators (which declare the SKU) and the
 * inventory ones (which stock it) — both sides have to agree on the exact
 * shape, or a row could be created for a code no variant can ever match.
 */
export const sku = Joi.string()
  .trim()
  .uppercase()
  .max(MAX_SKU_LENGTH)
  .pattern(/^[A-Z0-9][A-Z0-9-]*$/)
  .messages({
    "string.empty": "El SKU es obligatorio.",
    "string.max": `El SKU no puede exceder ${MAX_SKU_LENGTH} caracteres.`,
    "string.pattern.base": "El SKU solo admite letras, números y guiones.",
    "any.required": "El SKU es obligatorio.",
  });

/**
 * Rejects `<` and `>` in a free-text field the customer types directly (name,
 * address lines, delivery references) — a first, explicit layer against a
 * stored-XSS payload disguised as one of those. It does not replace
 * `sanitizeInput` (`middlewares/sanitize-input.ts`, which strips markup from
 * every request body globally) or `stripUnknown`; it's the field-level rule
 * whose Joi error message can name the offending field directly, and it fails
 * closed even if a future code path ever bypassed the global middleware.
 * Chain onto a field's own `.trim().max(n)` — never used standalone.
 */
export const NO_HTML_PATTERN = /^[^<>]*$/;
export const NO_HTML_MESSAGE = "No se permiten los caracteres < o >.";

/** `:id` path param, reused by every admin detail/update/delete route. */
export const idParamSchema = Joi.object({ id: objectId.required() });

/** `:slug` path param, used by the public detail routes. */
export const slugParamSchema = Joi.object({ slug: slug.required() });
