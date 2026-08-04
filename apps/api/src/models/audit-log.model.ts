import type { AuditAction } from "@bw-bikes/shared";
import { type Document, model, Schema, type Types } from "mongoose";

/**
 * Append-only audit trail (BACKEND_SECURITY_GUIDELINES.md §10). Nothing in
 * this codebase should ever call `updateOne`/`deleteOne`/`findOneAndUpdate`
 * on this model — only `create`, via `audit-log.service.ts`'s
 * `recordAuditLog()`, which is the sole writer and is itself best-effort
 * (a failed audit write never blocks the operation it was auditing).
 *
 * `before`/`after` are Mixed on purpose — different actions snapshot
 * different shapes — but must never carry PII/secrets (same limits as
 * general logging, §11): store ids, not raw user-entered values.
 */
export interface IAuditLog extends Document {
  actorId?: Types.ObjectId;
  actorType: "user" | "system";
  action: AuditAction;
  module: string;
  targetId?: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorType: { type: String, enum: ["user", "system"], required: true },
    action: { type: String, required: true },
    module: { type: String, required: true, index: true },
    targetId: { type: Schema.Types.ObjectId },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
