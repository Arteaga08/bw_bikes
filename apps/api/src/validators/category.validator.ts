import Joi from "joi";
import { MAX_CATEGORY_DESCRIPTION_LENGTH, MAX_CATEGORY_NAME_LENGTH } from "../models/index.js";
import { objectId, slug } from "./common.validator.js";

const name = Joi.string().trim().min(2).max(MAX_CATEGORY_NAME_LENGTH).messages({
  "string.empty": "El nombre es obligatorio.",
  "string.min": "El nombre debe tener al menos 2 caracteres.",
  "string.max": `El nombre no puede exceder ${MAX_CATEGORY_NAME_LENGTH} caracteres.`,
  "any.required": "El nombre es obligatorio.",
});

const description = Joi.string().trim().max(MAX_CATEGORY_DESCRIPTION_LENGTH).allow("").messages({
  "string.max": `La descripción no puede exceder ${MAX_CATEGORY_DESCRIPTION_LENGTH} caracteres.`,
});

// `null` is the root of the tree, not "missing" — it has to be explicitly
// allowed or an admin could never move a child category back up to root level.
const parent = objectId.allow(null).messages({
  "string.pattern.base": "La categoría padre es inválida.",
});

const order = Joi.number().integer().min(0).max(9999).messages({
  "number.base": "El orden debe ser un número.",
  "number.integer": "El orden debe ser un número entero.",
  "number.min": "El orden no puede ser negativo.",
});

/**
 * `isActive` is accepted on write because activating/deactivating a category
 * is a legitimate admin action. What is *not* accepted anywhere is a
 * server-derived field — `slug` is optional on create (derived from `name`
 * when absent) and timestamps never come from a payload.
 */
export const createCategorySchema = Joi.object({
  name: name.required(),
  slug: slug.optional(),
  description: description.optional(),
  parent: parent.default(null),
  order: order.default(0),
  isActive: Joi.boolean().default(true),
  usesSizes: Joi.boolean().default(true),
});

/** Every field optional, but at least one required — an empty PATCH is a client bug, not a no-op. */
export const updateCategorySchema = Joi.object({
  name: name.optional(),
  slug: slug.optional(),
  description: description.optional(),
  parent: parent.optional(),
  order: order.optional(),
  isActive: Joi.boolean().optional(),
  usesSizes: Joi.boolean().optional(),
})
  .min(1)
  .messages({ "object.min": "Envía al menos un campo para actualizar." });
