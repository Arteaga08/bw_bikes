import type { Request, Response } from "express";
import { accessoryService, toPublicAccessory } from "../services/accessory.service.js";
import { uploadImages } from "../services/storage/storage.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";
import { readUploadedFiles, sanitizeMultipartBody } from "./upload.helpers.js";

const CLOUDINARY_FOLDER = "accessories";

export const listPublicAccessories = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await accessoryService.list(req.query, { publicOnly: true });
  sendResponse(res, 200, "Accesorios obtenidos.", { accessories: documents.map(toPublicAccessory) }, meta);
});

export const getPublicAccessoryBySlug = asyncHandler(async (req: Request, res: Response) => {
  const accessory = await accessoryService.getBySlug(routeParam(req, "slug"), { publicOnly: true });
  sendResponse(res, 200, "Accesorio obtenido.", { accessory: toPublicAccessory(accessory) });
});

export const listAdminAccessories = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await accessoryService.list(req.query, { publicOnly: false });
  sendResponse(res, 200, "Accesorios obtenidos.", { accessories: documents }, meta);
});

export const getAdminAccessory = asyncHandler(async (req: Request, res: Response) => {
  const accessory = await accessoryService.getById(routeParam(req, "id"));
  sendResponse(res, 200, "Accesorio obtenido.", { accessory });
});

export const createAccessory = asyncHandler(async (req: Request, res: Response) => {
  const accessory = await accessoryService.create(req.body, requireActor(req));
  sendResponse(res, 201, "Accesorio creado.", { accessory });
});

export const updateAccessory = asyncHandler(async (req: Request, res: Response) => {
  const accessory = await accessoryService.update(routeParam(req, "id"), req.body, requireActor(req));
  sendResponse(res, 200, "Accesorio actualizado.", { accessory });
});

export const archiveAccessory = asyncHandler(async (req: Request, res: Response) => {
  const accessory = await accessoryService.archive(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Accesorio archivado.", { accessory });
});

export const restoreAccessory = asyncHandler(async (req: Request, res: Response) => {
  const accessory = await accessoryService.restore(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Accesorio restaurado.", { accessory });
});

export const replaceAccessorySpecGroups = asyncHandler(async (req: Request, res: Response) => {
  const { groups } = req.body as { groups: Parameters<typeof accessoryService.replaceSpecGroups>[1] };
  const accessory = await accessoryService.replaceSpecGroups(routeParam(req, "id"), groups, requireActor(req));
  sendResponse(res, 200, "Ficha técnica actualizada.", { specGroups: accessory.specGroups });
});

export const uploadAccessoryGallery = asyncHandler(async (req: Request, res: Response) => {
  sanitizeMultipartBody(req);
  const files = readUploadedFiles(req);
  const { alt } = req.body as { alt?: string };

  const uploaded = await uploadImages(files, CLOUDINARY_FOLDER);
  const accessory = await accessoryService.addGalleryImages(
    routeParam(req, "id"),
    uploaded.map((image) => ({ ...image, ...(alt ? { alt } : {}) })),
    requireActor(req),
  );

  sendResponse(res, 201, "Imágenes agregadas.", { gallery: accessory.gallery });
});

export const deleteAccessoryGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const { publicId } = req.body as { publicId: string };
  const accessory = await accessoryService.removeGalleryImage(routeParam(req, "id"), publicId, requireActor(req));
  sendResponse(res, 200, "Imagen eliminada.", { gallery: accessory.gallery });
});

export const reorderAccessoryGallery = asyncHandler(async (req: Request, res: Response) => {
  const { publicIds } = req.body as { publicIds: string[] };
  const accessory = await accessoryService.reorderGallery(routeParam(req, "id"), publicIds, requireActor(req));
  sendResponse(res, 200, "Galería reordenada.", { gallery: accessory.gallery });
});
