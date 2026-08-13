import Joi from "joi";
import { MAX_BRAND_DESCRIPTION_LENGTH, MAX_BRAND_NAME_LENGTH } from "../models/index.js";
import { slug } from "./common.validator.js";

const name = Joi.string().trim().min(1).max(MAX_BRAND_NAME_LENGTH).messages({
  "string.empty": "El nombre es obligatorio.",
  "string.max": `El nombre no puede exceder ${MAX_BRAND_NAME_LENGTH} caracteres.`,
  "any.required": "El nombre es obligatorio.",
});

const description = Joi.string().trim().max(MAX_BRAND_DESCRIPTION_LENGTH).allow("").messages({
  "string.max": `La descripción no puede exceder ${MAX_BRAND_DESCRIPTION_LENGTH} caracteres.`,
});

const order = Joi.number().integer().min(0).max(9999).messages({
  "number.base": "El orden debe ser un número.",
  "number.integer": "El orden debe ser un número entero.",
  "number.min": "El orden no puede ser negativo.",
});

export const createBrandSchema = Joi.object({
  name: name.required(),
  slug: slug.optional(),
  description: description.optional(),
  order: order.default(0),
  isActive: Joi.boolean().default(true),
});

export const updateBrandSchema = Joi.object({
  name: name.optional(),
  slug: slug.optional(),
  description: description.optional(),
  order: order.optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({ "object.min": "Envía al menos un campo para actualizar." });
