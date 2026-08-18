import type { AdminApplication, ApplicationStatus, ApplicationType } from "@bw-bikes/shared";
import { apiFetch } from "./client";
import type { ParsedResponse } from "./parse-response";

export interface AdminApplicationListParams {
  page?: number;
  limit?: number;
  /** Whitelisted by the backend to `createdAt` | `status` | `type`, `-` prefix for descending. */
  sort?: string;
  status?: ApplicationStatus;
  type?: ApplicationType;
}

/**
 * Builds the querystring from an explicit whitelist and drops empty values.
 * `search` is deliberately never sent — `adminApplicationListQuerySchema`
 * accepts it but `listForAdmin` ignores it (a known gap, not fixed in M11),
 * same precedent `admin-orders.ts` set for a param the backend accepts but
 * never reads.
 */
function buildApplicationListQuery(params: AdminApplicationListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.status) entries.push(["status", params.status]);
  if (params.type) entries.push(["type", params.type]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

export function listAdminApplications(
  params: AdminApplicationListParams,
): Promise<ParsedResponse<{ applications: AdminApplication[] }>> {
  return apiFetch<{ applications: AdminApplication[] }>(`/admin/applications${buildApplicationListQuery(params)}`);
}

export async function getAdminApplication(id: string): Promise<AdminApplication> {
  const { data } = await apiFetch<{ application: AdminApplication }>(`/admin/applications/${id}`);
  return data.application;
}

export async function approveApplication(id: string): Promise<AdminApplication> {
  const { data } = await apiFetch<{ application: AdminApplication }>(`/admin/applications/${id}/approve`, {
    method: "POST",
  });
  return data.application;
}

export async function rejectApplication(id: string, reason: string): Promise<AdminApplication> {
  const { data } = await apiFetch<{ application: AdminApplication }>(`/admin/applications/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return data.application;
}
