import { Schema, type Types } from "mongoose";

export const MAX_INTERNAL_NOTE_LENGTH = 1000;
/** Same reasoning as `MAX_STATUS_HISTORY` (order.model.ts): enough for any
 * real order; an unbounded array is a denial of service on the document
 * itself. */
export const MAX_INTERNAL_NOTES = 50;

/**
 * One staff-to-staff note on an order ("cliente llamó molesto por retraso,
 * enviar regalo compensatorio") — never served on a customer route, which is
 * why it lives only on `AdminOrder`, never on `PublicOrder`.
 *
 * `authorName` is a snapshot, not a lookup: the note must still read
 * correctly if the authoring account is later deleted or renamed, same
 * reasoning as `OrderLineSnapshot` freezing catalog data.
 *
 * `_id: false`: a property of the order, not an addressable sub-resource —
 * notes are only ever appended, never edited or deleted individually.
 */
export interface IOrderInternalNote {
  body: string;
  authorId: Types.ObjectId;
  authorName: string;
  createdAt: Date;
}

export const internalNoteSchema = new Schema<IOrderInternalNote>(
  {
    body: { type: String, required: true, trim: true, maxlength: MAX_INTERNAL_NOTE_LENGTH },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, trim: true, maxlength: 120 },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);
