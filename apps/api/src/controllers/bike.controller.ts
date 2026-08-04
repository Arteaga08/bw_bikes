import type { Request, Response } from "express";
import { bikeService, toPublicBike } from "../services/bike.service.js";
import { uploadImages } from "../services/storage/storage.service.js";
import { asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";
import { readUploadedFiles, sanitizeMultipartBody } from "./upload.helpers.js";

const CLOUDINARY_FOLDER = "bikes";

export const listPublicBikes = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await bikeService.list(req.query, { publicOnly: true });
  sendResponse(res, 200, "Bicicletas obtenidas.", { bikes: documents.map(toPublicBike) }, meta);
});

export const getPublicBikeBySlug = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.getPublicBySlug(routeParam(req, "slug"));
  sendResponse(res, 200, "Bicicleta obtenida.", { bike: toPublicBike(bike) });
});

export const listAdminBikes = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await bikeService.list(req.query, { publicOnly: false });
  sendResponse(res, 200, "Bicicletas obtenidas.", { bikes: documents }, meta);
});

export const getAdminBike = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.getById(routeParam(req, "id"));
  sendResponse(res, 200, "Bicicleta obtenida.", { bike });
});

export const createBike = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.create(req.body, requireActor(req));
  sendResponse(res, 201, "Bicicleta creada.", { bike });
});

export const updateBike = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.update(routeParam(req, "id"), req.body, requireActor(req));
  sendResponse(res, 200, "Bicicleta actualizada.", { bike });
});

export const archiveBike = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.archive(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Bicicleta archivada.", { bike });
});

export const restoreBike = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.restore(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Bicicleta restaurada.", { bike });
});

export const replaceBikeSpecGroups = asyncHandler(async (req: Request, res: Response) => {
  const { groups } = req.body as { groups: Parameters<typeof bikeService.replaceSpecGroups>[1] };
  const bike = await bikeService.replaceSpecGroups(routeParam(req, "id"), groups, requireActor(req));
  sendResponse(res, 200, "Ficha técnica actualizada.", { specGroups: bike.specGroups });
});

/**
 * The upload route is the one place a request arrives as `multipart/form-data`,
 * so the global `sanitizeInput` (which sits behind `express.json`) never saw
 * its text fields — `sanitizeMultipartBody` covers that gap explicitly, per
 * BACKEND_SECURITY_GUIDELINES.md §5.
 */
export const uploadBikeGallery = asyncHandler(async (req: Request, res: Response) => {
  sanitizeMultipartBody(req);
  const files = readUploadedFiles(req);
  const { alt } = req.body as { alt?: string };

  const uploaded = await uploadImages(files, CLOUDINARY_FOLDER);
  const bike = await bikeService.addGalleryImages(
    routeParam(req, "id"),
    uploaded.map((image) => ({ ...image, ...(alt ? { alt } : {}) })),
    requireActor(req),
  );

  sendResponse(res, 201, "Imágenes agregadas.", { gallery: bike.gallery });
});

export const deleteBikeGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const { publicId } = req.body as { publicId: string };
  const bike = await bikeService.removeGalleryImage(routeParam(req, "id"), publicId, requireActor(req));
  sendResponse(res, 200, "Imagen eliminada.", { gallery: bike.gallery });
});

export const reorderBikeGallery = asyncHandler(async (req: Request, res: Response) => {
  const { publicIds } = req.body as { publicIds: string[] };
  const bike = await bikeService.reorderGallery(routeParam(req, "id"), publicIds, requireActor(req));
  sendResponse(res, 200, "Galería reordenada.", { gallery: bike.gallery });
});
