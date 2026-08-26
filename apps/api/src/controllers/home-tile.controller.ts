import type { HomeTileSlot } from "@bw-bikes/shared";
import type { Request, Response } from "express";
import { requireActor } from "./category.controller.js";
import { readUploadedFiles, sanitizeMultipartBody } from "./upload.helpers.js";
import { homeTileService } from "../services/home-tile.service.js";
import { uploadImages } from "../services/storage/storage.service.js";
import { asyncHandler, AppError, routeParam, sendResponse } from "../utils/index.js";

/** Cloudinary destination for both home CTA tile photos, same convention as `hero-slide.controller.ts`'s `CLOUDINARY_FOLDER`. */
const CLOUDINARY_FOLDER = "home-tiles";

/**
 * Thin controllers, same discipline as `hero-slide.controller.ts`: read the
 * request, call the service, hand the result to `sendResponse`.
 */

export const listAdminHomeTiles = asyncHandler(async (_req: Request, res: Response) => {
  const tiles = await homeTileService.listAdmin();
  sendResponse(res, 200, "Tarjetas obtenidas.", { tiles });
});

export const listPublicHomeTiles = asyncHandler(async (_req: Request, res: Response) => {
  const tiles = await homeTileService.listPublic();
  sendResponse(res, 200, "Tarjetas obtenidas.", { tiles });
});

/** A tile carries exactly one photo, same "exactly one file" narrowing as `hero-slide.controller.ts`'s `uploadHeroSlideImage`. */
export const uploadHomeTileImage = asyncHandler(async (req: Request, res: Response) => {
  sanitizeMultipartBody(req);
  const files = readUploadedFiles(req);
  if (files.length > 1) {
    throw new AppError("Envía una sola imagen.", 400);
  }
  const { alt } = req.body as { alt?: string };

  const [uploaded] = await uploadImages(files, CLOUDINARY_FOLDER);
  const tile = await homeTileService.setImage(
    routeParam(req, "slot") as HomeTileSlot,
    { ...uploaded!, ...(alt ? { alt } : {}) },
    requireActor(req),
  );
  sendResponse(res, 200, "Imagen actualizada.", { tile });
});

export const removeHomeTileImage = asyncHandler(async (req: Request, res: Response) => {
  const tile = await homeTileService.removeImage(routeParam(req, "slot") as HomeTileSlot, requireActor(req));
  sendResponse(res, 200, "Imagen eliminada.", { tile });
});
