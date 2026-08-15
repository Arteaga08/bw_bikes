import type { Request, Response } from "express";
import { sizeTemplateService, toSizeTemplateDto } from "../services/size-template.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";

/**
 * Admin-only, same reasoning as `spec-template.controller.ts`: a saved size
 * only ever feeds the editor's own chip picker, never a public endpoint.
 */

export const listAdminSizeTemplates = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await sizeTemplateService.list(req.query, { publicOnly: false });
  sendResponse(res, 200, "Tallas obtenidas.", { sizeTemplates: documents.map(toSizeTemplateDto) }, meta);
});

export const getAdminSizeTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await sizeTemplateService.findByIdOrFail(routeParam(req, "id"));
  sendResponse(res, 200, "Talla obtenida.", { sizeTemplate: toSizeTemplateDto(template) });
});

export const createSizeTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await sizeTemplateService.create(req.body, requireActor(req));
  sendResponse(res, 201, "Talla creada.", { sizeTemplate: toSizeTemplateDto(template) });
});

export const updateSizeTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await sizeTemplateService.update(routeParam(req, "id"), req.body, requireActor(req));
  sendResponse(res, 200, "Talla actualizada.", { sizeTemplate: toSizeTemplateDto(template) });
});

export const deleteSizeTemplate = asyncHandler(async (req: Request, res: Response) => {
  await sizeTemplateService.remove(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Talla eliminada.");
});
