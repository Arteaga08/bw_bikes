import Joi from "joi";
import { MAX_PRICE_CENTS } from "../models/index.js";

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

/** `:id` path param, reused by every admin detail/update/delete route. */
export const idParamSchema = Joi.object({ id: objectId.required() });

/** `:slug` path param, used by the public detail routes. */
export const slugParamSchema = Joi.object({ slug: slug.required() });
