import type { AuditAction } from "@bw-bikes/shared";
import { Types } from "mongoose";
import { logger } from "../config/logger.js";
import { AuditLog, type IAuditLog } from "../models/index.js";

interface RecordAuditLogParams {
  actorId?: Types.ObjectId | string | undefined;
  actorType: "user" | "system";
  action: AuditAction;
  module: string;
  targetId?: Types.ObjectId | string | undefined;
  before?: unknown;
  after?: unknown;
  ip?: string | undefined;
}

/**
 * Sole writer of the audit trail (BACKEND_SECURITY_GUIDELINES.md §10):
 * append-only, best-effort. A failure here is logged and swallowed, never
 * propagated — auditing a privileged action must never be the reason that
 * action fails for the actor performing it.
 */
export async function recordAuditLog(params: RecordAuditLogParams): Promise<void> {
  try {
    await AuditLog.create(params);
  } catch (error) {
    logger.error({ err: error, module: params.module, action: params.action }, "Failed to record audit log entry");
  }
}

interface ListForTargetParams {
  module: string;
  targetId: string;
  limit?: number;
}

const DEFAULT_ACTIVITY_LIMIT = 100;

/**
 * The read side of the audit trail — added in M11.5 for the order detail's
 * "Bitácora" section. `targetId` is a string here (a route param), not the
 * `Types.ObjectId | string | undefined` `recordAuditLog` accepts, because
 * this is always looking up one specific, already-known document: an invalid
 * id is a caller bug, not a valid "no entries" answer, so it throws rather
 * than silently returning `[]`.
 */
export async function listForTarget({
  module,
  targetId,
  limit = DEFAULT_ACTIVITY_LIMIT,
}: ListForTargetParams): Promise<IAuditLog[]> {
  return AuditLog.find({ module, targetId: new Types.ObjectId(targetId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
}
