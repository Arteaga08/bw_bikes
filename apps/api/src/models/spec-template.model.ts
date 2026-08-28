import { type Document, model, Schema } from "mongoose";
import { MAX_SPEC_FIELDS_PER_GROUP, MAX_SPEC_LABEL_LENGTH, MAX_SPEC_TITLE_LENGTH } from "./schemas/spec-group.schema.js";

export const MAX_SPEC_TEMPLATES = 50;

export type SpecTemplateSource = "manual" | "auto";

export interface ISpecTemplateField {
  label: string;
  order: number;
  /** Whether this label is offered as a filter group on the public catalog. Off by default — an admin opts a label in explicitly, never inferred from the data. */
  isFilterable: boolean;
}

export interface ISpecTemplate extends Document {
  title: string;
  /** Labels only, no values — a template is the *shape* of a group ("Geometría": Talla, Stack, Reach…), never a product's actual measurements. */
  fields: ISpecTemplateField[];
  /** `manual`: an admin created it explicitly via the CRUD. `auto`: learned the first time a product saved a group under this title. Never downgraded once `manual`. */
  source: SpecTemplateSource;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const specTemplateFieldSchema = new Schema<ISpecTemplateField>(
  {
    label: { type: String, required: true, trim: true, maxlength: MAX_SPEC_LABEL_LENGTH },
    order: { type: Number, required: true, min: 0 },
    isFilterable: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * A saved shape for a `SpecGroup` — a title ("Geometría", "Sistema
 * eléctrico") plus the labels it's expected to carry, with no values. The
 * embedded `specGroupSchema` on `Bike`/`Accessory` stays exactly as free-form
 * as before (see that file's doc comment); this collection exists purely so
 * the editor can prefill a group instead of the admin retyping the same
 * dozen labels on every product, and so what gets typed once is offered back
 * as autocomplete the next time.
 *
 * Global, not per-catalog: "Transmisión" means the same thing on a bike and
 * (for a very different product) a bike rack accessory — one shared memory,
 * same reasoning as `Brand`/`Badge`.
 */
const specTemplateSchema = new Schema<ISpecTemplate>(
  {
    title: { type: String, required: true, trim: true, unique: true, maxlength: MAX_SPEC_TITLE_LENGTH },
    fields: {
      type: [specTemplateFieldSchema],
      default: [],
      validate: {
        validator: (fields: unknown[]) => fields.length <= MAX_SPEC_FIELDS_PER_GROUP,
        message: `Una plantilla no puede tener más de ${MAX_SPEC_FIELDS_PER_GROUP} campos.`,
      },
    },
    source: { type: String, enum: ["manual", "auto"] satisfies SpecTemplateSource[], required: true },
    order: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

specTemplateSchema.index({ order: 1, title: 1 });

export const SpecTemplate = model<ISpecTemplate>("SpecTemplate", specTemplateSchema);
