import type { Request, Response } from "express";
import { couponCampaignService } from "../services/coupon-campaign.service.js";
import { couponService, toAdminCoupon } from "../services/coupon.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";

/**
 * Admin-only, same thin shape as `badge.controller.ts`.
 *
 * There is deliberately **no public "list coupons" route**. A customer types a
 * code they were given; enumerating live campaigns would hand every visitor
 * the shop's whole discount schedule. The only customer-facing surface is
 * `POST /cart/coupon`, which answers about one code at a time and is rate
 * limited for exactly that reason.
 */

export const listCoupons = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await couponService.list(req.query);
  sendResponse(res, 200, "Cupones obtenidos.", { coupons: documents.map(toAdminCoupon) }, meta);
});

export const getCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponService.findByIdOrFail(routeParam(req, "id"));
  sendResponse(res, 200, "Cupón obtenido.", { coupon: toAdminCoupon(coupon) });
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponService.create(req.body, requireActor(req));
  sendResponse(res, 201, "Cupón creado.", { coupon: toAdminCoupon(coupon) });
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponService.update(routeParam(req, "id"), req.body, requireActor(req));
  sendResponse(res, 200, "Cupón actualizado.", { coupon: toAdminCoupon(coupon) });
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  await couponService.remove(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Cupón eliminado.");
});

/**
 * Emails an existing campaign to a set of customers.
 *
 * Answers 200 with a per-recipient breakdown even when some sends failed —
 * a partial success is the normal outcome of a batch, and collapsing it into
 * an error would hide the thirty-eight that landed. The panel renders the
 * summary.
 */
export const sendCoupon = asyncHandler(async (req: Request, res: Response) => {
  const outcome = await couponCampaignService.sendExisting(
    { couponId: routeParam(req, "id"), ...(req.body as { userIds: string[]; message?: string }) },
    requireActor(req),
  );
  sendResponse(res, 200, `Cupón enviado a ${outcome.summary.sent} cliente(s).`, outcome);
});
