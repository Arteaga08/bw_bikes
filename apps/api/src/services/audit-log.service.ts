import type { AuditAction } from "@bw-bikes/shared";
import type { Types } from "mongoose";
import { logger } from "../config/logger.js";
import { AuditLog } from "../models/index.js";

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
