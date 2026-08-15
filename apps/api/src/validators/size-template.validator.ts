import Joi from "joi";
import { MAX_SIZE_LENGTH } from "../models/index.js";

const value = Joi.string().trim().min(1).max(MAX_SIZE_LENGTH).messages({
  "string.empty": "El valor es obligatorio.",
  "string.max": `El valor no puede exceder ${MAX_SIZE_LENGTH} caracteres.`,
  "any.required": "El valor es obligatorio.",
});

const order = Joi.number().integer().min(0).max(9999).messages({
  "number.base": "El orden debe ser un número.",
  "number.integer": "El orden debe ser un número entero.",
  "number.min": "El orden no puede ser negativo.",
});

export const createSizeTemplateSchema = Joi.object({
  value: value.required(),
  order: order.default(0),
  isActive: Joi.boolean().default(true),
});

export const updateSizeTemplateSchema = Joi.object({
  value: value.optional(),
  order: order.optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({ "object.min": "Envía al menos un campo para actualizar." });
