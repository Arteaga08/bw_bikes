import type { BadgeVariant } from "@bw-bikes/shared";
import Joi from "joi";
import { MAX_BADGE_LABEL_LENGTH } from "../models/index.js";
import { slug } from "./common.validator.js";

const BADGE_VARIANTS: BadgeVariant[] = ["accent", "unavailable", "exito", "advertencia", "error", "neutral"];

const label = Joi.string().trim().min(1).max(MAX_BADGE_LABEL_LENGTH).messages({
  "string.empty": "La etiqueta es obligatoria.",
  "string.max": `La etiqueta no puede exceder ${MAX_BADGE_LABEL_LENGTH} caracteres.`,
  "any.required": "La etiqueta es obligatoria.",
});

const variant = Joi.string()
  .valid(...BADGE_VARIANTS)
  .messages({ "any.only": "La variante no es válida.", "any.required": "La variante es obligatoria." });

const order = Joi.number().integer().min(0).max(9999).messages({
  "number.base": "El orden debe ser un número.",
  "number.integer": "El orden debe ser un número entero.",
  "number.min": "El orden no puede ser negativo.",
});

export const createBadgeSchema = Joi.object({
  label: label.required(),
  slug: slug.optional(),
  variant: variant.required(),
  order: order.default(0),
  isActive: Joi.boolean().default(true),
});

export const updateBadgeSchema = Joi.object({
  label: label.optional(),
  slug: slug.optional(),
  variant: variant.optional(),
  order: order.optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({ "object.min": "Envía al menos un campo para actualizar." });
