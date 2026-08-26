import type { BikeOfMonthInput } from "@bw-bikes/shared";
import type { Request, Response } from "express";
import { requireActor } from "./category.controller.js";
import { readUploadedFiles, sanitizeMultipartBody } from "./upload.helpers.js";
import { bikeOfMonthService } from "../services/bike-of-month.service.js";
import { uploadImages } from "../services/storage/storage.service.js";
import { asyncHandler, AppError, sendResponse } from "../utils/index.js";

/** Cloudinary destination for the banner's photo, same convention as `home-tile.controller.ts`'s `CLOUDINARY_FOLDER`. */
const CLOUDINARY_FOLDER = "bike-of-month";

/** Thin controllers, same discipline as `home-tile.controller.ts`: read the request, call the service, hand the result to `sendResponse`. */

export const getAdminBikeOfMonth = asyncHandler(async (_req: Request, res: Response) => {
  const bikeOfMonth = await bikeOfMonthService.getAdmin();
  sendResponse(res, 200, "Banner obtenido.", { bikeOfMonth });
});

export const getPublicBikeOfMonth = asyncHandler(async (_req: Request, res: Response) => {
  const bikeOfMonth = await bikeOfMonthService.getPublic();
  sendResponse(res, 200, "Banner obtenido.", { bikeOfMonth });
});

export const updateBikeOfMonth = asyncHandler(async (req: Request, res: Response) => {
  const bikeOfMonth = await bikeOfMonthService.updateText(req.body as BikeOfMonthInput, requireActor(req));
  sendResponse(res, 200, "Banner actualizado.", { bikeOfMonth });
});

/** The banner carries exactly one photo, same "exactly one file" narrowing as `home-tile.controller.ts`'s `uploadHomeTileImage`. */
export const uploadBikeOfMonthImage = asyncHandler(async (req: Request, res: Response) => {
  sanitizeMultipartBody(req);
  const files = readUploadedFiles(req);
  if (files.length > 1) {
    throw new AppError("Envía una sola imagen.", 400);
  }
  const { alt } = req.body as { alt?: string };

  const [uploaded] = await uploadImages(files, CLOUDINARY_FOLDER);
  const bikeOfMonth = await bikeOfMonthService.setImage({ ...uploaded!, ...(alt ? { alt } : {}) }, requireActor(req));
  sendResponse(res, 200, "Imagen actualizada.", { bikeOfMonth });
});

export const removeBikeOfMonthImage = asyncHandler(async (req: Request, res: Response) => {
  const bikeOfMonth = await bikeOfMonthService.removeImage(requireActor(req));
  sendResponse(res, 200, "Imagen eliminada.", { bikeOfMonth });
});
