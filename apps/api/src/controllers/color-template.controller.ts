import type { Request, Response } from "express";
import { colorTemplateService, toColorTemplateDto } from "../services/color-template.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";

/**
 * A plain module of handlers, not a factory — `ColorTemplate` is one shared
 * collection (see its own model doc comment), unlike `size-template.controller.ts`'s
 * `createSizeTemplateController`, which exists to be instantiated per catalog.
 * Admin-only, same reasoning as sizes: a saved color only ever feeds the
 * editor's own picker, never a public endpoint.
 */
export const listAdminColorTemplates = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await colorTemplateService.list(req.query);
  sendResponse(res, 200, "Colores obtenidos.", { colorTemplates: documents.map(toColorTemplateDto) }, meta);
});

export const getAdminColorTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await colorTemplateService.findByIdOrFail(routeParam(req, "id"));
  sendResponse(res, 200, "Color obtenido.", { colorTemplate: toColorTemplateDto(template) });
});

export const createColorTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await colorTemplateService.create(req.body, requireActor(req));
  sendResponse(res, 201, "Color creado.", { colorTemplate: toColorTemplateDto(template) });
});

export const updateColorTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await colorTemplateService.update(routeParam(req, "id"), req.body, requireActor(req));
  sendResponse(res, 200, "Color actualizado.", { colorTemplate: toColorTemplateDto(template) });
});

export const removeColorTemplate = asyncHandler(async (req: Request, res: Response) => {
  await colorTemplateService.remove(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Color eliminado.");
});
