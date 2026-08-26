import type {
  AdminCoupon,
  AdminCustomerDetail,
  AdminCustomerSummary,
  CouponType,
  CustomersStats,
  StatsPreset,
} from "@bw-bikes/shared";
import { apiFetch } from "./client";
import type { ParsedResponse } from "./parse-response";

/**
 * The customer registry (M22), against M20's backend.
 *
 * Read-only, mirroring the API: editing a customer is not a CRM operation
 * this shop asked for, and an admin able to rewrite someone's email is an
 * account-takeover path no screen here needs.
 */

export interface AdminCustomerListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  /** "Quién ha comprado más de una vez" — the segment worth an outreach coupon. */
  repeatBuyersOnly?: boolean;
  /** Drops registered accounts that never bought. */
  buyersOnly?: boolean;
}

function buildCustomerListQuery(params: AdminCustomerListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.search) entries.push(["search", params.search]);
  if (params.repeatBuyersOnly) entries.push(["repeatBuyersOnly", "true"]);
  if (params.buyersOnly) entries.push(["buyersOnly", "true"]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

async function listCustomers(
  params: AdminCustomerListParams = {},
): Promise<ParsedResponse<AdminCustomerSummary[]>> {
  const res = await apiFetch<{ customers: AdminCustomerSummary[] }>(
    `/admin/customers${buildCustomerListQuery(params)}`,
  );
  return { data: res.data.customers, ...(res.meta ? { meta: res.meta } : {}) };
}

async function getCustomerById(id: string): Promise<AdminCustomerDetail> {
  const res = await apiFetch<{ customer: AdminCustomerDetail }>(`/admin/customers/${id}`);
  return res.data.customer;
}

async function getCustomersStats(preset?: StatsPreset): Promise<CustomersStats> {
  const query = preset ? `?preset=${preset}` : "";
  const res = await apiFetch<{ stats: CustomersStats }>(`/admin/stats/customers${query}`);
  return res.data.stats;
}


/** What the "generar al vuelo" form sends. The service pins the single-use limits. */
export interface GenerateCouponInput {
  type: CouponType;
  percentOffBps?: number;
  amountOffCents?: number;
  maxDiscountCents?: number;
  minSubtotalCents?: number;
  expiresAt?: string;
  message?: string;
}

async function generateCouponFor(customerId: string, input: GenerateCouponInput): Promise<AdminCoupon> {
  const res = await apiFetch<{ coupon: AdminCoupon }>(`/admin/customers/${customerId}/coupons`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data.coupon;
}

export const adminCustomersApi = {
  list: listCustomers,
  getById: getCustomerById,
  stats: getCustomersStats,
  generateCoupon: generateCouponFor,
};
