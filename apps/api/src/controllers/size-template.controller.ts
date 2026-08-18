import type { Request, Response } from "express";
import type { SizeTemplateService } from "../services/size-template.service.js";
import { toSizeTemplateDto } from "../services/size-template.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";

/**
 * One controller factory, instantiated per size catalog (bikes, accessories)
 * — same shape as `category.controller.ts`'s `createCategoryController`.
 * Admin-only, same reasoning as `spec-template.controller.ts`: a saved size
 * only ever feeds the editor's own chip picker, never a public endpoint.
 */
export function createSizeTemplateController(service: SizeTemplateService) {
  const listAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { documents, meta } = await service.list(req.query, { publicOnly: false });
    sendResponse(res, 200, "Tallas obtenidas.", { sizeTemplates: documents.map(toSizeTemplateDto) }, meta);
  });

  const getById = asyncHandler(async (req: Request, res: Response) => {
    const template = await service.findByIdOrFail(routeParam(req, "id"));
    sendResponse(res, 200, "Talla obtenida.", { sizeTemplate: toSizeTemplateDto(template) });
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
    const template = await service.create(req.body, requireActor(req));
    sendResponse(res, 201, "Talla creada.", { sizeTemplate: toSizeTemplateDto(template) });
  });

  const update = asyncHandler(async (req: Request, res: Response) => {
    const template = await service.update(routeParam(req, "id"), req.body, requireActor(req));
    sendResponse(res, 200, "Talla actualizada.", { sizeTemplate: toSizeTemplateDto(template) });
  });

  const remove = asyncHandler(async (req: Request, res: Response) => {
    await service.remove(routeParam(req, "id"), requireActor(req));
    sendResponse(res, 200, "Talla eliminada.");
  });

  return { listAdmin, getById, create, update, remove };
}
