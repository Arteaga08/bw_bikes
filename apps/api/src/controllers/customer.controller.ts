import type { Request, Response } from "express";
import { couponCampaignService } from "../services/coupon-campaign.service.js";
import { toAdminCoupon } from "../services/coupon.service.js";
import { customerService } from "../services/customer.service.js";
import { requireActor } from "./category.controller.js";
import { getCustomersStats } from "../services/stats/customers.stats.js";
import { asyncHandler, parseStatsRange, routeParam, sendResponse } from "../utils/index.js";

/**
 * The customer registry (M20). Admin-only — a CRM screen lists real people's
 * emails and purchase history, which is not customer-facing data.
 */

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await customerService.list(req.query);
  sendResponse(res, 200, "Clientes obtenidos.", { customers: documents }, meta);
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await customerService.getDetail(routeParam(req, "id"));
  sendResponse(res, 200, "Cliente obtenido.", { customer });
});

export const getCustomersStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const stats = await getCustomersStats(parseStatsRange(req.query));
  sendResponse(res, 200, "Estadísticas de clientes obtenidas.", { stats });
});

/** Mints a one-off coupon for this customer and emails it, in one step. */
export const generateCustomerCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { coupon } = await couponCampaignService.generateAndSend(
    { userId: routeParam(req, "id"), ...req.body },
    requireActor(req),
  );
  sendResponse(res, 201, "Cupón generado y enviado.", { coupon: toAdminCoupon(coupon) });
});
