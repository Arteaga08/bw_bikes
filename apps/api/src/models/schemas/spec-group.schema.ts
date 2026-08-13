import { Schema } from "mongoose";

/**
 * Free-form technical sheet, embedded in the product document — no
 * collection of *values* (see the design spec §"Ficha técnica libre"). The
 * admin builds whatever groups and fields each product needs; the write
 * itself is still one atomic replace of this embedded array.
 *
 * M10.3 revisits "no templates" for the group/field *shape* only: every
 * title and label written here also feeds `spec-template.model.ts`'s
 * `SpecTemplate` collection, a separate, label-only memory the editor
 * autocompletes from — a title or label, never a value, since values are
 * per-product by definition. See that file's own doc comment.
 *
 * The caps below are the reason this is safe to leave free-form: without them
 * an admin (or a compromised admin session) could grow a single document past
 * Mongo's 16MB limit. They are enforced twice — here at the schema level and
 * again in the Joi validator — so a write that bypasses the route still can't
 * produce an unbounded document.
 *
 * These values are display-only and are never filtered on; anything the
 * storefront must filter by lives in a typed first-class column instead.
 */

export const MAX_SPEC_GROUPS = 20;
export const MAX_SPEC_FIELDS_PER_GROUP = 30;
export const MAX_SPEC_TITLE_LENGTH = 80;
export const MAX_SPEC_LABEL_LENGTH = 80;
export const MAX_SPEC_VALUE_LENGTH = 400;

const specFieldSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: MAX_SPEC_LABEL_LENGTH },
    value: { type: String, required: true, trim: true, maxlength: MAX_SPEC_VALUE_LENGTH },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

export const specGroupSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: MAX_SPEC_TITLE_LENGTH },
    order: { type: Number, required: true, min: 0 },
    fields: {
      type: [specFieldSchema],
      default: [],
      validate: {
        validator: (fields: unknown[]) => fields.length <= MAX_SPEC_FIELDS_PER_GROUP,
        message: `Un grupo no puede tener más de ${MAX_SPEC_FIELDS_PER_GROUP} campos.`,
      },
    },
  },
  { _id: false },
);
