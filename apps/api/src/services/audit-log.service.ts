import type { AdminAuditLog, AuditAction } from "@bw-bikes/shared";
import { Types } from "mongoose";
import { logger } from "../config/logger.js";
import { AuditLog, type IAuditLog } from "../models/index.js";
import { buildMeta, parseListQuery } from "../utils/index.js";

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

interface PopulatedActor {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
}

function toAdminAuditLog(doc: IAuditLog): AdminAuditLog {
  // `.populated("actorId")` is false both for a system entry (no `actorId`
  // at all) and for a user entry whose `.populate()` didn't resolve (the
  // account was deleted) — both correctly read back as `actor: null`.
  const populatedActor = doc.populated("actorId") ? (doc.actorId as unknown as PopulatedActor) : undefined;

  return {
    id: String(doc._id),
    actorType: doc.actorType,
    actor: populatedActor
      ? {
          id: String(populatedActor._id),
          email: populatedActor.email,
          firstName: populatedActor.firstName,
          lastName: populatedActor.lastName,
        }
      : null,
    action: doc.action,
    module: doc.module,
    targetId: doc.targetId ? String(doc.targetId) : null,
    ...(doc.before !== undefined ? { before: doc.before } : {}),
    ...(doc.after !== undefined ? { after: doc.after } : {}),
    ...(doc.ip !== undefined ? { ip: doc.ip } : {}),
    createdAt: doc.createdAt.toISOString(),
  };
}

const AUDIT_SORTABLE_FIELDS = ["createdAt"] as const;

export interface ListAuditLogsResult {
  logs: AdminAuditLog[];
  meta: ReturnType<typeof buildMeta>;
}

/**
 * The superadmin audit viewer's read surface (M11) — `GET /admin/audit-logs`.
 * Unlike `listForTarget`, this is a general-purpose paginated listing: no
 * `targetId` is assumed, and every filter is optional. Named query params
 * only, same discipline as every other admin listing — the client's query
 * object is never spread into the filter.
 */
export async function listAuditLogs(query: Record<string, unknown>): Promise<ListAuditLogsResult> {
  const { page, limit, skip, sort } = parseListQuery(query, {
    allowedSortFields: AUDIT_SORTABLE_FIELDS,
    defaultSort: "-createdAt",
  });

  const filter: Record<string, unknown> = {};

  if (typeof query["module"] === "string") filter["module"] = query["module"];
  if (typeof query["action"] === "string") filter["action"] = query["action"];

  const actorId = query["actorId"];
  if (typeof actorId === "string" && Types.ObjectId.isValid(actorId)) {
    filter["actorId"] = new Types.ObjectId(actorId);
  }

  const from = query["from"];
  const to = query["to"];
  if (typeof from === "string" || typeof to === "string") {
    const range: Record<string, Date> = {};
    if (typeof from === "string") range["$gte"] = new Date(from);
    if (typeof to === "string") range["$lte"] = new Date(to);
    filter["createdAt"] = range;
  }

  const [documents, total] = await Promise.all([
    AuditLog.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("actorId", "email firstName lastName")
      .exec(),
    AuditLog.countDocuments(filter).exec(),
  ]);

  return { logs: documents.map(toAdminAuditLog), meta: buildMeta(total, page, limit) };
}
