import { Schema } from "mongoose";
import { MAX_SPEC_LABEL_LENGTH, MAX_SPEC_VALUE_LENGTH } from "./spec-group.schema.js";

/**
 * The "En pocas palabras" card (M10.6) — the short overview block a bike's PDP
 * shows next to the marketing copy, before the full technical sheet.
 *
 * Deliberately **not** derived from `specGroupSchema`. The client chose a
 * hand-written block over flagging rows of the sheet, so the summary is free
 * to word things its own way: "Transmisión: SRAM XX SL Eagle" as one row,
 * where the sheet below lists shifters, derailleurs and cassette separately.
 * The accepted cost is that a value living in both places is captured twice
 * and has to be corrected twice.
 *
 * Six rows is the cap because past that the card stops being a summary and
 * turns into a second spec sheet — the reference PDPs show exactly six.
 * Fewer is fine; an empty `summary` just means the card doesn't render.
 *
 * Lengths are reused from `spec-group.schema.ts` rather than redeclared:
 * a label and a value mean the same thing here as they do there.
 */

export const MAX_SUMMARY_ROWS = 6;

export const summaryRowSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: MAX_SPEC_LABEL_LENGTH },
    value: { type: String, required: true, trim: true, maxlength: MAX_SPEC_VALUE_LENGTH },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
