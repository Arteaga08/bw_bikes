import type { ApplicationStatus, ApplicationType } from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";
import type { AttachmentFormat } from "../utils/index.js";

export const MAX_REJECTION_REASON_LENGTH = 300;
const MAX_SHORT_FIELD_LENGTH = 150;
const MAX_LONG_FIELD_LENGTH = 1000;
const MAX_ORIGINAL_NAME_LENGTH = 200;

/** A document with more attachments than this is not a real application. */
export const MAX_APPLICATION_ATTACHMENTS = 5;

const ATTACHMENT_FORMATS = ["jpeg", "png", "webp", "avif", "pdf"] as const satisfies readonly AttachmentFormat[];

export interface IAmbassadorDetails {
  discipline: string;
  city: string;
  socialMediaHandle: string;
  followersApprox: number;
  motivation: string;
}

export interface ISponsorshipDetails {
  eventName: string;
  eventDate: Date;
  venue: string;
  expectedAttendees: number;
  supportRequested: string;
}

export interface IApplicationAttachment {
  publicId: string;
  format: AttachmentFormat;
  originalName: string;
}

export interface IApplication extends Document {
  userId: Types.ObjectId;
  type: ApplicationType;
  status: ApplicationStatus;
  ambassador?: IAmbassadorDetails;
  sponsorship?: ISponsorshipDetails;
  attachments: IApplicationAttachment[];
  /** Present only once `status` is `rejected`. */
  rejectionReason?: string;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ambassadorSchema = new Schema<IAmbassadorDetails>(
  {
    discipline: { type: String, required: true, trim: true, maxlength: MAX_SHORT_FIELD_LENGTH },
    city: { type: String, required: true, trim: true, maxlength: MAX_SHORT_FIELD_LENGTH },
    socialMediaHandle: { type: String, required: true, trim: true, maxlength: MAX_SHORT_FIELD_LENGTH },
    followersApprox: { type: Number, required: true, min: 0 },
    motivation: { type: String, required: true, trim: true, maxlength: MAX_LONG_FIELD_LENGTH },
  },
  { _id: false },
);

const sponsorshipSchema = new Schema<ISponsorshipDetails>(
  {
    eventName: { type: String, required: true, trim: true, maxlength: MAX_SHORT_FIELD_LENGTH },
    eventDate: { type: Date, required: true },
    venue: { type: String, required: true, trim: true, maxlength: MAX_SHORT_FIELD_LENGTH },
    expectedAttendees: { type: Number, required: true, min: 0 },
    supportRequested: { type: String, required: true, trim: true, maxlength: MAX_LONG_FIELD_LENGTH },
  },
  { _id: false },
);

/** Only `publicId` and `format` are ever read from again — see `buildSignedAttachmentUrl`. */
const attachmentSchema = new Schema<IApplicationAttachment>(
  {
    publicId: { type: String, required: true, trim: true },
    format: { type: String, enum: ATTACHMENT_FORMATS, required: true },
    originalName: { type: String, required: true, trim: true, maxlength: MAX_ORIGINAL_NAME_LENGTH },
  },
  { _id: false },
);

/**
 * A single collection for both forms the spec calls for — ambassador and
 * event sponsorship — discriminated by `type`. They share the entire
 * lifecycle (pending/approved/rejected, mandatory rejection reason,
 * reapplication cooldown, attachments) and differ only in which detail
 * sub-document is populated; two collections would duplicate all of that for
 * no benefit. The schema-level validator below is what stops a document from
 * carrying the wrong detail block, or both, or neither — never
 * `Schema.Types.Mixed`.
 */
const applicationSchema = new Schema<IApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["ambassador", "event_sponsorship"], required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], required: true, default: "pending" },

    ambassador: { type: ambassadorSchema },
    sponsorship: { type: sponsorshipSchema },

    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: (attachments: unknown[]) => attachments.length <= MAX_APPLICATION_ATTACHMENTS,
        message: `Una solicitud no puede tener más de ${MAX_APPLICATION_ATTACHMENTS} adjuntos.`,
      },
    },

    rejectionReason: { type: String, trim: true, maxlength: MAX_REJECTION_REASON_LENGTH },
    rejectedAt: { type: Date },
  },
  { timestamps: true },
);

applicationSchema.pre("validate", function assertDetailsMatchType(next) {
  const hasAmbassador = this.ambassador !== undefined;
  const hasSponsorship = this.sponsorship !== undefined;

  if (this.type === "ambassador" && (!hasAmbassador || hasSponsorship)) {
    next(new Error('Una solicitud de tipo "ambassador" debe traer exactamente los datos de embajador.'));
    return;
  }
  if (this.type === "event_sponsorship" && (!hasSponsorship || hasAmbassador)) {
    next(new Error('Una solicitud de tipo "event_sponsorship" debe traer exactamente los datos de patrocinio.'));
    return;
  }
  next();
});

// The concurrency guard: two simultaneous submissions of the same type by the
// same customer can only ever produce one `pending` document. A
// find-then-create in application service code would be a read-then-write
// race — this index is what actually serializes it, same reasoning as the
// webhook dedupe in `payment-event.model.ts`. Partial, not sparse: `userId`
// and `type` always exist, so a plain compound unique index would forbid a
// second *lifetime* application of the same type outright.
applicationSchema.index(
  { userId: 1, type: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

// The cooldown/history lookup: "what did this customer last submit of this type".
applicationSchema.index({ userId: 1, type: 1, createdAt: -1 });

// The admin bandeja: newest first, optionally filtered by status.
applicationSchema.index({ status: 1, createdAt: -1 });

export const Application = model<IApplication>("Application", applicationSchema);
