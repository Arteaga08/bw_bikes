import type { AdminCoupon, CouponScope, CouponType } from "@bw-bikes/shared";
import { apiFetch } from "./client";
import type { ParsedResponse } from "./parse-response";

/**
 * Coupon campaigns (M19), against the M18 backend.
 *
 * Same module shape as `adminBrandsApi`: an explicit params interface, a
 * whitelist query builder that mirrors the API's Joi schema rather than
 * spreading a raw filter object, and one exported object at the bottom.
 *
 * There is deliberately no public/storefront counterpart here. A customer
 * applies a code through `POST /cart/coupon`; enumerating live campaigns is
 * an admin-only capability by design.
 */

export interface AdminCouponListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  isActive?: boolean;
}

function buildCouponListQuery(params: AdminCouponListParams): string {
  const entries: Array<[string, string]> = [];
  if (params.page !== undefined) entries.push(["page", String(params.page)]);
  if (params.limit !== undefined) entries.push(["limit", String(params.limit)]);
  if (params.sort) entries.push(["sort", params.sort]);
  if (params.search) entries.push(["search", params.search]);
  if (params.isActive !== undefined) entries.push(["isActive", String(params.isActive)]);

  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

/**
 * What the form sends. `percentOffBps` and `amountOffCents` are mutually
 * exclusive and must match `type` — the API enforces both with a Joi `xor`
 * plus a schema hook, so the form only has to send the right one.
 */
export interface CouponInput {
  code: string;
  name: string;
  type: CouponType;
  percentOffBps?: number;
  amountOffCents?: number;
  maxDiscountCents?: number;
  minSubtotalCents?: number;
  scope?: CouponScope;
  startsAt?: string;
  expiresAt?: string;
  maxRedemptionsTotal?: number;
  maxRedemptionsPerCustomer?: number;
  isActive?: boolean;
}

async function listCoupons(params: AdminCouponListParams = {}): Promise<ParsedResponse<AdminCoupon[]>> {
  const res = await apiFetch<{ coupons: AdminCoupon[] }>(`/admin/coupons${buildCouponListQuery(params)}`);
  return { data: res.data.coupons, ...(res.meta ? { meta: res.meta } : {}) };
}

async function getCouponById(id: string): Promise<AdminCoupon> {
  const res = await apiFetch<{ coupon: AdminCoupon }>(`/admin/coupons/${id}`);
  return res.data.coupon;
}

async function createCoupon(input: CouponInput): Promise<AdminCoupon> {
  const res = await apiFetch<{ coupon: AdminCoupon }>("/admin/coupons", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data.coupon;
}

async function updateCoupon(id: string, input: Partial<CouponInput>): Promise<AdminCoupon> {
  const res = await apiFetch<{ coupon: AdminCoupon }>(`/admin/coupons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data.coupon;
}

async function removeCoupon(id: string): Promise<void> {
  await apiFetch(`/admin/coupons/${id}`, { method: "DELETE" });
}


/** One outcome per recipient, so the panel can say "38 enviados, 2 fallaron". */
export interface CouponSendResult {
  userId: string;
  email?: string;
  status: "sent" | "failed" | "skipped";
  reason?: string;
}

export interface CouponSendOutcome {
  results: CouponSendResult[];
  summary: { sent: number; failed: number; skipped: number };
}

/**
 * Emails an existing campaign to a set of customers.
 *
 * Resolves on a partial failure — the API answers 200 with the breakdown,
 * because a batch where thirty-eight landed and two didn't is not an error,
 * it's a result the admin needs to read.
 */
async function sendCoupon(
  couponId: string,
  input: { userIds: string[]; message?: string },
): Promise<CouponSendOutcome> {
  const res = await apiFetch<CouponSendOutcome>(`/admin/coupons/${couponId}/send`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export const adminCouponsApi = {
  list: listCoupons,
  getById: getCouponById,
  create: createCoupon,
  update: updateCoupon,
  remove: removeCoupon,
  send: sendCoupon,
};
