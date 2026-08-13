import type { Request, Response } from "express";
import { specTemplateService, toSpecTemplateDto } from "../services/spec-template.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";

/**
 * Admin-only, same reasoning as `badge.controller.ts`: a template only ever
 * feeds the editor's own picker/autocomplete, never a public endpoint.
 */

export const listAdminSpecTemplates = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await specTemplateService.list(req.query, { publicOnly: false });
  sendResponse(res, 200, "Plantillas obtenidas.", { templates: documents.map(toSpecTemplateDto) }, meta);
});

export const getAdminSpecTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await specTemplateService.findByIdOrFail(routeParam(req, "id"));
  sendResponse(res, 200, "Plantilla obtenida.", { template: toSpecTemplateDto(template) });
});

export const createSpecTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await specTemplateService.create(req.body, requireActor(req));
  sendResponse(res, 201, "Plantilla creada.", { template: toSpecTemplateDto(template) });
});

export const updateSpecTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await specTemplateService.update(routeParam(req, "id"), req.body, requireActor(req));
  sendResponse(res, 200, "Plantilla actualizada.", { template: toSpecTemplateDto(template) });
});

export const deleteSpecTemplate = asyncHandler(async (req: Request, res: Response) => {
  await specTemplateService.remove(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Plantilla eliminada.");
});
