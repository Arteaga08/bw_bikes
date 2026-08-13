import type { Request, Response } from "express";
import { brandService, toAdminBrand, toPublicBrand } from "../services/brand.service.js";
import { uploadImages } from "../services/storage/storage.service.js";
import { AppError, asyncHandler, routeParam, sendResponse } from "../utils/index.js";
import { requireActor } from "./category.controller.js";
import { readUploadedFiles, sanitizeMultipartBody } from "./upload.helpers.js";

const CLOUDINARY_FOLDER = "brands";

/**
 * Thin controller, same shape as `category.controller.ts`'s: read the
 * request, call the service, hand the result to `sendResponse`. Not a
 * factory — unlike categories, there's exactly one brand collection shared
 * by both catalogs.
 */

export const listPublicBrands = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await brandService.list(req.query, { publicOnly: true });
  sendResponse(res, 200, "Marcas obtenidas.", { brands: documents.map(toPublicBrand) }, meta);
});

export const getPublicBrandBySlug = asyncHandler(async (req: Request, res: Response) => {
  const brand = await brandService.getBySlug(routeParam(req, "slug"), { publicOnly: true });
  sendResponse(res, 200, "Marca obtenida.", { brand: toPublicBrand(brand) });
});

export const listAdminBrands = asyncHandler(async (req: Request, res: Response) => {
  const { documents, meta } = await brandService.list(req.query, { publicOnly: false });
  sendResponse(res, 200, "Marcas obtenidas.", { brands: documents.map(toAdminBrand) }, meta);
});

export const getAdminBrand = asyncHandler(async (req: Request, res: Response) => {
  const brand = await brandService.findByIdOrFail(routeParam(req, "id"));
  sendResponse(res, 200, "Marca obtenida.", { brand: toAdminBrand(brand) });
});

export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const brand = await brandService.create(req.body, requireActor(req));
  sendResponse(res, 201, "Marca creada.", { brand: toAdminBrand(brand) });
});

export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const brand = await brandService.update(routeParam(req, "id"), req.body, requireActor(req));
  sendResponse(res, 200, "Marca actualizada.", { brand: toAdminBrand(brand) });
});

export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  await brandService.remove(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Marca eliminada.");
});

/** A brand carries at most one logo — same "exactly one file" narrowing as `category.controller.ts`'s `uploadImage`. */
export const uploadBrandLogo = asyncHandler(async (req: Request, res: Response) => {
  sanitizeMultipartBody(req);
  const files = readUploadedFiles(req);
  if (files.length > 1) {
    throw new AppError("Envía un solo logo.", 400);
  }
  const { alt } = req.body as { alt?: string };

  const [uploaded] = await uploadImages(files, CLOUDINARY_FOLDER);
  const brand = await brandService.setLogo(
    routeParam(req, "id"),
    { ...uploaded!, ...(alt ? { alt } : {}) },
    requireActor(req),
  );
  sendResponse(res, 200, "Logo actualizado.", { brand: toAdminBrand(brand) });
});

export const removeBrandLogo = asyncHandler(async (req: Request, res: Response) => {
  const brand = await brandService.removeLogo(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Logo eliminado.", { brand: toAdminBrand(brand) });
});
