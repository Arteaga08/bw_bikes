import Joi from "joi";
import { MAX_SPEC_FIELDS_PER_GROUP, MAX_SPEC_LABEL_LENGTH, MAX_SPEC_TITLE_LENGTH } from "../models/index.js";

const title = Joi.string().trim().min(1).max(MAX_SPEC_TITLE_LENGTH).messages({
  "string.empty": "El título es obligatorio.",
  "string.max": `El título no puede exceder ${MAX_SPEC_TITLE_LENGTH} caracteres.`,
  "any.required": "El título es obligatorio.",
});

const order = Joi.number().integer().min(0).max(999).required().messages({
  "number.base": "El orden debe ser un número.",
  "any.required": "El orden es obligatorio.",
});

/** Labels only — a template is the shape of a group, never a product's actual values (see `spec-template.model.ts`). */
const field = Joi.object({
  label: Joi.string().trim().min(1).max(MAX_SPEC_LABEL_LENGTH).required().messages({
    "string.empty": "La etiqueta es obligatoria.",
    "string.max": `La etiqueta no puede exceder ${MAX_SPEC_LABEL_LENGTH} caracteres.`,
    "any.required": "La etiqueta es obligatoria.",
  }),
  order,
  isFilterable: Joi.boolean().default(false),
});

const fields = Joi.array().items(field).max(MAX_SPEC_FIELDS_PER_GROUP).messages({
  "array.max": `Una plantilla no puede tener más de ${MAX_SPEC_FIELDS_PER_GROUP} campos.`,
});

const templateOrder = Joi.number().integer().min(0).max(9999).messages({
  "number.base": "El orden debe ser un número.",
  "number.integer": "El orden debe ser un número entero.",
  "number.min": "El orden no puede ser negativo.",
});

export const createSpecTemplateSchema = Joi.object({
  title: title.required(),
  fields: fields.default([]),
  order: templateOrder.default(0),
  isActive: Joi.boolean().default(true),
});

export const updateSpecTemplateSchema = Joi.object({
  title: title.optional(),
  fields: fields.optional(),
  order: templateOrder.optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({ "object.min": "Envía al menos un campo para actualizar." });
