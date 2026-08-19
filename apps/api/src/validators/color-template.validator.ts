import Joi from "joi";
import { HEX_PATTERN, MAX_COLOR_LENGTH } from "../models/index.js";

const value = Joi.string().trim().min(1).max(MAX_COLOR_LENGTH).messages({
  "string.empty": "El valor es obligatorio.",
  "string.max": `El valor no puede exceder ${MAX_COLOR_LENGTH} caracteres.`,
  "any.required": "El valor es obligatorio.",
});

const hex = Joi.string().trim().pattern(HEX_PATTERN).messages({
  "string.empty": "El color es obligatorio.",
  "string.pattern.base": "El color debe ser un hexadecimal válido (#RRGGBB).",
  "any.required": "El color es obligatorio.",
});

const secondaryHex = hex.allow(null).messages({
  "string.pattern.base": "El segundo color debe ser un hexadecimal válido (#RRGGBB).",
});

const order = Joi.number().integer().min(0).max(9999).messages({
  "number.base": "El orden debe ser un número.",
  "number.integer": "El orden debe ser un número entero.",
  "number.min": "El orden no puede ser negativo.",
});

export const createColorTemplateSchema = Joi.object({
  value: value.required(),
  hex: hex.required(),
  secondaryHex: secondaryHex.optional(),
  order: order.default(0),
  isActive: Joi.boolean().default(true),
});

export const updateColorTemplateSchema = Joi.object({
  value: value.optional(),
  hex: hex.optional(),
  secondaryHex: secondaryHex.optional(),
  order: order.optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({ "object.min": "Envía al menos un campo para actualizar." });
