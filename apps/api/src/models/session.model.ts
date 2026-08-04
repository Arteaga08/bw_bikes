import { type Document, model, Schema, type Types } from "mongoose";

/**
 * A single refresh token in a rotating chain. `familyId` is stable across
 * an entire login-to-logout lineage: every rotation (`refresh`) creates a
 * new document with the same `familyId` and marks the old one
 * revoked+`replacedBy`. If a refresh token is ever presented after it's
 * already been rotated away, that's a signal of theft/replay — the whole
 * family gets revoked (see `token.service.ts`), not just the one token.
 */
export interface ISession extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedBy?: string;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    // TTL index: Mongo's background task removes the document once this
    // date is reached (expires: 0 → exactly at the stored value, not N
    // seconds after it).
    expiresAt: { type: Date, required: true, expires: 0 },
    revokedAt: { type: Date },
    replacedBy: { type: String },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Session = model<ISession>("Session", sessionSchema);
