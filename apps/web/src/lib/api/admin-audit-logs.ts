import type { AdminAuditLog, AuditAction } from "@bw-bikes/shared";
import { apiFetch } from "./client";
import type { ParsedResponse } from "./parse-response";

export interface AdminAuditLogListParams {
  page?: number;
  limit?: number;
  /** Only `createdAt` is sortable — this whitelist mirrors `auditLogListQuerySchema`. */
  sort?: string;
  module?: string;
  action?: AuditAction;
  actorId?: string;
  /** ISO date, inclusive. */
  from?: string;
  /** ISO date, inclusive. */
  to?: string;
}

/** Builds the querystring from an explicit whitelist and drops empty values — mirrors `auditLogListQuerySchema`. */
function buildAuditLogListQuery(params: AdminAuditLogListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.module) entries.push(["module", params.module]);
  if (params.action) entries.push(["action", params.action]);
  if (params.actorId) entries.push(["actorId", params.actorId]);
  if (params.from) entries.push(["from", params.from]);
  if (params.to) entries.push(["to", params.to]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

/** Superadmin-only on the server (`restrictTo("superadmin")`) — a plain admin's call 403s regardless of what the UI hides. */
export function listAdminAuditLogs(
  params: AdminAuditLogListParams,
): Promise<ParsedResponse<{ logs: AdminAuditLog[] }>> {
  return apiFetch<{ logs: AdminAuditLog[] }>(`/admin/audit-logs${buildAuditLogListQuery(params)}`);
}
