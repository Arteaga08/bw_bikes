import type { HeroSlideInput } from "@bw-bikes/shared";
import type { Request, Response } from "express";
import { requireActor } from "./category.controller.js";
import { readUploadedFiles, sanitizeMultipartBody } from "./upload.helpers.js";
import { heroSlideService } from "../services/hero-slide.service.js";
import { uploadImages } from "../services/storage/storage.service.js";
import { asyncHandler, AppError, routeParam, sendResponse } from "../utils/index.js";

/** Cloudinary destination for every hero slide's photo, same convention as `bike.controller.ts`'s `CLOUDINARY_FOLDER`. */
const CLOUDINARY_FOLDER = "hero";

/**
 * Thin controllers, same discipline as `category.controller.ts`: read the
 * request, call the service, hand the result to `sendResponse` — no
 * business rules live here.
 */

export const listAdminHeroSlides = asyncHandler(async (_req: Request, res: Response) => {
  const slides = await heroSlideService.listAdmin();
  sendResponse(res, 200, "Slides obtenidos.", { slides });
});

export const listPublicHeroSlides = asyncHandler(async (_req: Request, res: Response) => {
  const slides = await heroSlideService.listPublic();
  sendResponse(res, 200, "Slides obtenidos.", { slides });
});

export const createHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const slide = await heroSlideService.create(req.body as HeroSlideInput, requireActor(req));
  sendResponse(res, 201, "Slide creado.", { slide });
});

export const updateHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const slide = await heroSlideService.update(routeParam(req, "id"), req.body as HeroSlideInput, requireActor(req));
  sendResponse(res, 200, "Slide actualizado.", { slide });
});

export const deleteHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  await heroSlideService.remove(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Slide eliminado.");
});

export const reorderHeroSlides = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  const slides = await heroSlideService.reorder(ids, requireActor(req));
  sendResponse(res, 200, "Orden actualizado.", { slides });
});

/**
 * A slide carries exactly one photo, same "exactly one file" narrowing as
 * `category.controller.ts`'s `uploadImage`.
 */
export const removeHeroSlideImage = asyncHandler(async (req: Request, res: Response) => {
  const slide = await heroSlideService.removeImage(routeParam(req, "id"), requireActor(req));
  sendResponse(res, 200, "Imagen eliminada.", { slide });
});

export const uploadHeroSlideImage = asyncHandler(async (req: Request, res: Response) => {
  sanitizeMultipartBody(req);
  const files = readUploadedFiles(req);
  if (files.length > 1) {
    throw new AppError("Envía una sola imagen.", 400);
  }
  const { alt } = req.body as { alt?: string };

  const [uploaded] = await uploadImages(files, CLOUDINARY_FOLDER);
  const slide = await heroSlideService.setImage(
    routeParam(req, "id"),
    { ...uploaded!, ...(alt ? { alt } : {}) },
    requireActor(req),
  );
  sendResponse(res, 200, "Imagen actualizada.", { slide });
});
