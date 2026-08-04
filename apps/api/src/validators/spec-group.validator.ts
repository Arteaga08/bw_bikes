import Joi from "joi";
import {
  MAX_SPEC_FIELDS_PER_GROUP,
  MAX_SPEC_GROUPS,
  MAX_SPEC_LABEL_LENGTH,
  MAX_SPEC_TITLE_LENGTH,
  MAX_SPEC_VALUE_LENGTH,
} from "../models/index.js";

const order = Joi.number().integer().min(0).max(999).required().messages({
  "number.base": "El orden debe ser un número.",
  "any.required": "El orden es obligatorio.",
});

const specField = Joi.object({
  label: Joi.string().trim().min(1).max(MAX_SPEC_LABEL_LENGTH).required().messages({
    "string.empty": "La etiqueta del campo es obligatoria.",
    "string.max": `La etiqueta no puede exceder ${MAX_SPEC_LABEL_LENGTH} caracteres.`,
    "any.required": "La etiqueta del campo es obligatoria.",
  }),
  value: Joi.string().trim().min(1).max(MAX_SPEC_VALUE_LENGTH).required().messages({
    "string.empty": "El valor del campo es obligatorio.",
    "string.max": `El valor no puede exceder ${MAX_SPEC_VALUE_LENGTH} caracteres.`,
    "any.required": "El valor del campo es obligatorio.",
  }),
  order,
});

const specGroup = Joi.object({
  title: Joi.string().trim().min(1).max(MAX_SPEC_TITLE_LENGTH).required().messages({
    "string.empty": "El título del grupo es obligatorio.",
    "string.max": `El título no puede exceder ${MAX_SPEC_TITLE_LENGTH} caracteres.`,
    "any.required": "El título del grupo es obligatorio.",
  }),
  order,
  fields: Joi.array().items(specField).max(MAX_SPEC_FIELDS_PER_GROUP).default([]).messages({
    "array.max": `Un grupo no puede tener más de ${MAX_SPEC_FIELDS_PER_GROUP} campos.`,
  }),
});

/**
 * The whole spec sheet is submitted as one array. A single replace covers all
 * four operations the milestone requires — add, rename, reorder and delete,
 * for both groups and fields — in one atomic write, which is also exactly how
 * the M10 editor will save: the admin edits the sheet as a unit and hits save.
 *
 * (The per-section endpoints the architecture guideline prescribes are for a
 * `Settings` singleton with independent concurrent editors; a product's spec
 * sheet is not that.)
 *
 * `groups: []` is valid and legitimately clears the sheet.
 */
export const replaceSpecGroupsSchema = Joi.object({
  groups: Joi.array().items(specGroup).max(MAX_SPEC_GROUPS).required().messages({
    "array.base": "La ficha técnica debe ser una lista de grupos.",
    "array.max": `La ficha técnica no puede tener más de ${MAX_SPEC_GROUPS} grupos.`,
    "any.required": "La ficha técnica es obligatoria.",
  }),
});

export { specGroup as specGroupSchemaJoi };
