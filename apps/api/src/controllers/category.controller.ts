import type { Request, Response } from "express";
import type { CategoryService } from "../services/category.service.js";
import { toPublicCategory } from "../services/category.service.js";
import { AppError, asyncHandler, routeParam, sendResponse } from "../utils/index.js";

/**
 * One controller factory, instantiated per category tree. Controllers stay
 * thin: read the request, call the service, hand the result to
 * `sendResponse` — no DB access, no business rules.
 */

function requireActor(req: Request): { actorId: string; ip?: string | undefined } {
  if (!req.user) {
    throw new AppError("No autenticado.", 401);
  }
  return { actorId: req.user.id, ip: req.ip };
}

export function createCategoryController(service: CategoryService, labels: { plural: string }) {
  const listPublic = asyncHandler(async (req: Request, res: Response) => {
    const { categories, meta } = await service.list(req.query, { publicOnly: true });
    sendResponse(res, 200, `${labels.plural} obtenidas.`, { categories }, meta);
  });

  const listAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { categories, meta } = await service.list(req.query, { publicOnly: false });
    sendResponse(res, 200, `${labels.plural} obtenidas.`, { categories }, meta);
  });

  const treePublic = asyncHandler(async (_req: Request, res: Response) => {
    const tree = await service.tree({ publicOnly: true });
    sendResponse(res, 200, "Árbol de categorías obtenido.", { tree });
  });

  const treeAdmin = asyncHandler(async (_req: Request, res: Response) => {
    const tree = await service.tree({ publicOnly: false });
    sendResponse(res, 200, "Árbol de categorías obtenido.", { tree });
  });

  const getBySlugPublic = asyncHandler(async (req: Request, res: Response) => {
    const category = await service.getBySlug(routeParam(req, "slug"), { publicOnly: true });
    sendResponse(res, 200, "Categoría obtenida.", { category: toPublicCategory(category) });
  });

  const getByIdAdmin = asyncHandler(async (req: Request, res: Response) => {
    const category = await service.findByIdOrFail(routeParam(req, "id"));
    sendResponse(res, 200, "Categoría obtenida.", { category });
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
    const category = await service.create(req.body, requireActor(req));
    sendResponse(res, 201, "Categoría creada.", { category });
  });

  const update = asyncHandler(async (req: Request, res: Response) => {
    const category = await service.update(routeParam(req, "id"), req.body, requireActor(req));
    sendResponse(res, 200, "Categoría actualizada.", { category });
  });

  const remove = asyncHandler(async (req: Request, res: Response) => {
    await service.remove(routeParam(req, "id"), requireActor(req));
    sendResponse(res, 200, "Categoría eliminada.");
  });

  return { listPublic, listAdmin, treePublic, treeAdmin, getBySlugPublic, getByIdAdmin, create, update, remove };
}

export { requireActor };
