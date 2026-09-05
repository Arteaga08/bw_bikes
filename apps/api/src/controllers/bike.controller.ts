import type { Request, Response } from "express";
import { BikeSizeTemplate, type ISizeTemplate } from "../models/index.js";
import { bikeCategoryService } from "../services/bike-category.service.js";
import { bikeService, toAdminBike, toPublicBike } from "../services/bike.service.js";
import { buildSizeGuide } from "../services/size-template.service.js";
import { uploadImages } from "../services/storage/storage.service.js";
import { AppError, asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";
import { readUploadedFiles, sanitizeMultipartBody } from "./upload.helpers.js";

const CLOUDINARY_FOLDER = "bikes";
/** Its own folder, not `bikes/`: a geometry chart is a diagram, never a carousel shot, and keeping them apart makes the commercial gallery browsable in Cloudinary. */
const CLOUDINARY_GEOMETRY_FOLDER = "bike-geometry";

export const listPublicBikes = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await bikeService.list(req.query, { publicOnly: true });
  sendResponse(res, 200, "Bicicletas obtenidas.", { bikes: documents.map(toPublicBike) }, meta);
});

export const getBikeFilterOptions = asyncHandler(async (_req: Request, res: Response) => {
  const options = await bikeService.getFilterOptions();
  sendResponse(res, 200, "Opciones de filtro obtenidas.", options);
});

/**
 * Just the color swatches (`CatalogProductCard`'s dots, the PDP's cross-sell
 * chips) — a page with no filter sidebar has no use for the other four
 * facets `getBikeFilterOptions` also computes (M-optimización).
 */
export const getBikeColorSwatches = asyncHandler(async (_req: Request, res: Response) => {
  const colors = await bikeService.getColorSwatches();
  sendResponse(res, 200, "Colores obtenidos.", { colors });
});

/**
 * The PDP's "¿Cuál es mi talla?" / "Guía de tallas" — every active bike size
 * with a height range that resolves for the given category, category
 * overrides already applied. `categoryId` is required: the guide is
 * meaningless without knowing which product it's for (an override on
 * "Montaña" shouldn't leak into a "Ruta" PDP).
 */
export const getBikeSizeGuide = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = String(req.query["categoryId"]);

  // Independent reads — the category lookup only feeds `buildSizeGuide`
  // below, not the template query's own filter — so there's no reason for
  // one to wait on the other.
  const [category, templates] = await Promise.all([
    bikeCategoryService.findByIdOrFail(categoryId),
    // `.lean()`: `buildSizeGuide` only reads plain fields, same reasoning as
    // `size-template.service.ts`'s own `list()`.
    BikeSizeTemplate.find({ isActive: true }).lean().exec() as unknown as Promise<ISizeTemplate[]>,
  ]);

  const sizeGuide = buildSizeGuide(templates, category.id, category.parent);
  sendResponse(res, 200, "Guía de tallas obtenida.", { sizeGuide });
});

export const getPublicBikeBySlug = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.getPublicBySlug(routeParam(req, "slug"));
  sendResponse(res, 200, "Bicicleta obtenida.", { bike: toPublicBike(bike) });
});

export const listAdminBikes = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await bikeService.list(req.query, { publicOnly: false });
  sendResponse(res, 200, "Bicicletas obtenidas.", { bikes: documents.map(toAdminBike) }, meta);
});

export const getAdminBike = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.getAdminById(routeParam(req, "id"));
  sendResponse(res, 200, "Bicicleta obtenida.", { bike: toAdminBike(bike) });
});

export const createBike = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.create(req.body, requireActor(req));
  sendResponse(res, 201, "Bicicleta creada.", { bike: toAdminBike(bike) });
});

export const updateBike = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.update(routeParam(req, "id"), req.body, requireActor(req));
  sendResponse(res, 200, "Bicicleta actualizada.", { bike: toAdminBike(bike) });
});

export const archiveBike = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.archive(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Bicicleta archivada.", { bike: toAdminBike(bike) });
});

export const restoreBike = asyncHandler(async (req: Request, res: Response) => {
  const bike = await bikeService.restore(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Bicicleta restaurada.", { bike: toAdminBike(bike) });
});

export const deleteBike = asyncHandler(async (req: Request, res: Response) => {
  await bikeService.remove(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Bicicleta eliminada.");
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
  const { alt, color } = req.body as { alt?: string; color?: string };

  const uploaded = await uploadImages(files, CLOUDINARY_FOLDER);
  const bike = await bikeService.addGalleryImages(
    routeParam(req, "id"),
    uploaded.map((image) => ({ ...image, ...(alt ? { alt } : {}), ...(color ? { color } : {}) })),
    requireActor(req),
  );

  sendResponse(res, 201, "Imágenes agregadas.", { gallery: bike.gallery });
});

export const deleteBikeGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const { publicId } = req.body as { publicId: string };
  const bike = await bikeService.removeGalleryImage(routeParam(req, "id"), publicId, requireActor(req));
  sendResponse(res, 200, "Imagen eliminada.", { gallery: bike.gallery });
});

export const updateBikeGalleryImageColor = asyncHandler(async (req: Request, res: Response) => {
  const { publicId, color } = req.body as { publicId: string; color?: string };
  const bike = await bikeService.updateGalleryImageColor(routeParam(req, "id"), publicId, color, requireActor(req));
  sendResponse(res, 200, "Color de la imagen actualizado.", { gallery: bike.gallery });
});

export const reorderBikeGallery = asyncHandler(async (req: Request, res: Response) => {
  const { publicIds } = req.body as { publicIds: string[] };
  const bike = await bikeService.reorderGallery(routeParam(req, "id"), publicIds, requireActor(req));
  sendResponse(res, 200, "Galería reordenada.", { gallery: bike.gallery });
});

/** A bike carries at most one geometry chart — same "exactly one file" narrowing as `brand.controller.ts`'s `uploadBrandLogo`. Uploading again replaces it. */
export const uploadBikeGeometryImage = asyncHandler(async (req: Request, res: Response) => {
  sanitizeMultipartBody(req);
  const files = readUploadedFiles(req);
  if (files.length > 1) {
    throw new AppError("Envía una sola imagen de geometría.", 400);
  }
  const { alt } = req.body as { alt?: string };

  const [uploaded] = await uploadImages(files, CLOUDINARY_GEOMETRY_FOLDER);
  const bike = await bikeService.setGeometryImage(
    routeParam(req, "id"),
    { ...uploaded!, ...(alt ? { alt } : {}) },
    requireActor(req),
  );

  sendResponse(res, 200, "Imagen de geometría actualizada.", { geometryImage: bike.geometryImage });
});

export const deleteBikeGeometryImage = asyncHandler(async (req: Request, res: Response) => {
  await bikeService.removeGeometryImage(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Imagen de geometría eliminada.", { geometryImage: null });
});
