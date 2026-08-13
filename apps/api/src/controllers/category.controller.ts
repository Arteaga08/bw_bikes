import type { Request, Response } from "express";
import type { CategoryService } from "../services/category.service.js";
import { toAdminCategory, toPublicCategory } from "../services/category.service.js";
import { uploadImages } from "../services/storage/storage.service.js";
import { AppError, asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { readUploadedFiles, sanitizeMultipartBody } from "./upload.helpers.js";

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

/**
 * `folder` is the Cloudinary destination for this tree's images
 * (`"bike-categories"` / `"accessory-categories"`), same pattern as
 * `CLOUDINARY_FOLDER` in `bike.controller.ts`/`accessory.controller.ts`.
 */
export function createCategoryController(service: CategoryService, labels: { plural: string }, folder: string) {
  const listPublic = asyncHandler(async (req: Request, res: Response) => {
    const { documents, meta } = await service.list(req.query, { publicOnly: true });
    sendResponse(res, 200, `${labels.plural} obtenidas.`, { categories: documents.map(toPublicCategory) }, meta);
  });

  const listAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { documents, meta } = await service.list(req.query, { publicOnly: false });
    sendResponse(res, 200, `${labels.plural} obtenidas.`, { categories: documents.map(toAdminCategory) }, meta);
  });

  const treePublic = asyncHandler(async (_req: Request, res: Response) => {
    const tree = await service.tree({ publicOnly: true });
    const nodes = tree.map(({ root, children }) => ({
      ...toPublicCategory(root),
      children: children.map(toPublicCategory),
    }));
    sendResponse(res, 200, "Árbol de categorías obtenido.", { tree: nodes });
  });

  const treeAdmin = asyncHandler(async (_req: Request, res: Response) => {
    const tree = await service.tree({ publicOnly: false });
    const nodes = tree.map(({ root, children }) => ({
      ...toAdminCategory(root),
      children: children.map(toAdminCategory),
    }));
    sendResponse(res, 200, "Árbol de categorías obtenido.", { tree: nodes });
  });

  const getBySlugPublic = asyncHandler(async (req: Request, res: Response) => {
    const category = await service.getBySlug(routeParam(req, "slug"), { publicOnly: true });
    sendResponse(res, 200, "Categoría obtenida.", { category: toPublicCategory(category) });
  });

  const getByIdAdmin = asyncHandler(async (req: Request, res: Response) => {
    const category = await service.findByIdOrFail(routeParam(req, "id"));
    sendResponse(res, 200, "Categoría obtenida.", { category: toAdminCategory(category) });
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
    const category = await service.create(req.body, requireActor(req));
    sendResponse(res, 201, "Categoría creada.", { category: toAdminCategory(category) });
  });

  const update = asyncHandler(async (req: Request, res: Response) => {
    const category = await service.update(routeParam(req, "id"), req.body, requireActor(req));
    sendResponse(res, 200, "Categoría actualizada.", { category: toAdminCategory(category) });
  });

  const remove = asyncHandler(async (req: Request, res: Response) => {
    await service.remove(routeParam(req, "id"), requireActor(req));
    sendResponse(res, 200, "Categoría eliminada.");
  });

  /**
   * A category carries at most one image, so — unlike the product gallery,
   * which accepts up to `MAX_FILES_PER_REQUEST` — exactly one file is the
   * only valid request. `uploadImages()` still does the real work (magic
   * bytes, Cloudinary); this only narrows what multer handed it.
   */
  const uploadImage = asyncHandler(async (req: Request, res: Response) => {
    sanitizeMultipartBody(req);
    const files = readUploadedFiles(req);
    if (files.length > 1) {
      throw new AppError("Envía una sola imagen.", 400);
    }
    const { alt } = req.body as { alt?: string };

    const [uploaded] = await uploadImages(files, folder);
    const category = await service.setImage(
      routeParam(req, "id"),
      { ...uploaded!, ...(alt ? { alt } : {}) },
      requireActor(req),
    );
    sendResponse(res, 200, "Imagen actualizada.", { category: toAdminCategory(category) });
  });

  const removeImage = asyncHandler(async (req: Request, res: Response) => {
    const category = await service.removeImage(routeParam(req, "id"), requireActor(req));
    sendResponse(res, 200, "Imagen eliminada.", { category: toAdminCategory(category) });
  });

  return {
    listPublic,
    listAdmin,
    treePublic,
    treeAdmin,
    getBySlugPublic,
    getByIdAdmin,
    create,
    update,
    remove,
    uploadImage,
    removeImage,
  };
}

export { requireActor };
