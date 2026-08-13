import type { Request, Response } from "express";
import { badgeService, toAdminBadge } from "../services/badge.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";

/**
 * Thin controller, same shape as `brand.controller.ts`'s — admin-only, no
 * public surface: a badge only ever ships resolved onto a product's own
 * `badges` array (`toPublicBike`/`toPublicAccessory`), never as its own list.
 */

export const listAdminBadges = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await badgeService.list(req.query, { publicOnly: false });
  sendResponse(res, 200, "Badges obtenidos.", { badges: documents.map(toAdminBadge) }, meta);
});

export const getAdminBadge = asyncHandler(async (req: Request, res: Response) => {
  const badge = await badgeService.findByIdOrFail(routeParam(req, "id"));
  sendResponse(res, 200, "Badge obtenido.", { badge: toAdminBadge(badge) });
});

export const createBadge = asyncHandler(async (req: Request, res: Response) => {
  const badge = await badgeService.create(req.body, requireActor(req));
  sendResponse(res, 201, "Badge creado.", { badge: toAdminBadge(badge) });
});

export const updateBadge = asyncHandler(async (req: Request, res: Response) => {
  const badge = await badgeService.update(routeParam(req, "id"), req.body, requireActor(req));
  sendResponse(res, 200, "Badge actualizado.", { badge: toAdminBadge(badge) });
});

export const deleteBadge = asyncHandler(async (req: Request, res: Response) => {
  await badgeService.remove(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Badge eliminado.");
});
