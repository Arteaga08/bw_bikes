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

/** Defaults to `true` so a payload written before M10.6 — or by any client that doesn't know the flag — still saves as visible. */
const visible = Joi.boolean().default(true).messages({
  "boolean.base": "La visibilidad debe ser verdadero o falso.",
});

const specField = Joi.object({
  label: Joi.string().trim().min(1).max(MAX_SPEC_LABEL_LENGTH).required().messages({
    "string.empty": "La etiqueta del campo es obligatoria.",
    "string.max": `La etiqueta no puede exceder ${MAX_SPEC_LABEL_LENGTH} caracteres.`,
    "any.required": "La etiqueta del campo es obligatoria.",
  }),
  // Blank is legitimate (M10.6): a row the admin turned off, or one applied
  // from a template and not filled in yet, must not block the whole save. The
  // storefront skips blank rows the same way it skips hidden ones.
  value: Joi.string().trim().max(MAX_SPEC_VALUE_LENGTH).allow("").default("").messages({
    "string.max": `El valor no puede exceder ${MAX_SPEC_VALUE_LENGTH} caracteres.`,
  }),
  order,
  visible,
});

const specGroup = Joi.object({
  title: Joi.string().trim().min(1).max(MAX_SPEC_TITLE_LENGTH).required().messages({
    "string.empty": "El título del grupo es obligatorio.",
    "string.max": `El título no puede exceder ${MAX_SPEC_TITLE_LENGTH} caracteres.`,
    "any.required": "El título del grupo es obligatorio.",
  }),
  order,
  visible,
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
