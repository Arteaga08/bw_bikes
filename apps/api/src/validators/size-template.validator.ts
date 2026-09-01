import Joi from "joi";
import { MAX_BODY_HEIGHT_CM, MAX_SIZE_CATEGORY_OVERRIDES, MAX_SIZE_LENGTH, MIN_BODY_HEIGHT_CM } from "../models/index.js";
import { objectId } from "./common.validator.js";

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

const heightCm = Joi.number().integer().min(MIN_BODY_HEIGHT_CM).max(MAX_BODY_HEIGHT_CM).messages({
  "number.base": "La estatura debe ser un número.",
  "number.integer": "La estatura debe ser un número entero.",
  "number.min": `La estatura no puede ser menor a ${MIN_BODY_HEIGHT_CM} cm.`,
  "number.max": `La estatura no puede ser mayor a ${MAX_BODY_HEIGHT_CM} cm.`,
});

/** `minHeightCm`/`maxHeightCm` — both or neither (`.and`), and the max must beat the min. Shared shape between the base range and each category override. */
const heightRange = Joi.object({
  minHeightCm: heightCm.required(),
  maxHeightCm: heightCm.greater(Joi.ref("minHeightCm")).required().messages({
    "number.greater": "La estatura máxima debe ser mayor a la mínima.",
  }),
});

const categoryOverrides = Joi.array()
  .items(
    Joi.object({
      categoryId: objectId.required(),
      minHeightCm: heightCm.required(),
      maxHeightCm: heightCm.greater(Joi.ref("minHeightCm")).required().messages({
        "number.greater": "La estatura máxima debe ser mayor a la mínima.",
      }),
    }),
  )
  .max(MAX_SIZE_CATEGORY_OVERRIDES)
  .unique("categoryId")
  .messages({
    "array.max": `No se pueden agregar más de ${MAX_SIZE_CATEGORY_OVERRIDES} ajustes por categoría.`,
    "array.unique": "Cada categoría solo puede tener un ajuste.",
  });

export const createSizeTemplateSchema = Joi.object({
  value: value.required(),
  order: order.default(0),
  isActive: Joi.boolean().default(true),
  heightRange: heightRange.optional().allow(null),
  categoryOverrides: categoryOverrides.default([]),
});

export const updateSizeTemplateSchema = Joi.object({
  value: value.optional(),
  order: order.optional(),
  isActive: Joi.boolean().optional(),
  heightRange: heightRange.optional().allow(null),
  categoryOverrides: categoryOverrides.optional(),
})
  .min(1)
  .messages({ "object.min": "Envía al menos un campo para actualizar." });
