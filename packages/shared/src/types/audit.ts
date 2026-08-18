import type { AuditAction } from "./auth.js";

export interface AdminAuditLogActor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * One entry of the audit trail, as `GET /admin/audit-logs` returns it —
 * superadmin-only (M11). `before`/`after`/`ip` ride along here unfiltered:
 * this is the forensic record, and the route restricting it is already the
 * access control, not a second redaction on top of it.
 */
export interface AdminAuditLog {
  id: string;
  actorType: "user" | "system";
  /** `null` for a system-authored entry, or a user whose account no longer resolves. */
  actor: AdminAuditLogActor | null;
  action: AuditAction;
  module: string;
  targetId: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string;
  createdAt: string;
}
