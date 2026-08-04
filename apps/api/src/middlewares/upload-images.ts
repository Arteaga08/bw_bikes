import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import { AppError } from "../utils/index.js";

/** 5 MB per file. A 2400px product photo lands well under this even uncompressed. */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Matches MAX_GALLERY_IMAGES so one request can populate a whole gallery. */
const MAX_FILES_PER_REQUEST = 15;

/**
 * Receives the upload **in memory** (never to disk) with hard limits, so a
 * hostile client can't fill the container's filesystem and nothing untrusted
 * is ever written where it might later be served.
 *
 * There is deliberately **no `fileFilter` checking mimetype here**: the
 * declared `Content-Type` and the filename are both supplied by the client, so
 * filtering on them provides no security, only the illusion of it. The real
 * check is `prepareImage`'s magic-byte inspection of the buffer itself
 * (services/storage/image-pipeline.ts), which runs before a single byte
 * reaches Cloudinary. The `limits` below are what this layer genuinely
 * enforces, and they apply before the body is fully read.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES_PER_REQUEST },
});

const receiveFiles = upload.array("images", MAX_FILES_PER_REQUEST);

/**
 * Wraps multer so its errors become operational `AppError`s with Spanish copy
 * instead of surfacing as a generic 500 through the global error handler.
 */
export function uploadImages(req: Request, res: Response, next: NextFunction): void {
  receiveFiles(req, res, (error: unknown) => {
    if (error instanceof MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(new AppError(`Cada imagen debe pesar menos de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`, 400));
        return;
      }
      if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
        next(new AppError(`No se pueden subir más de ${MAX_FILES_PER_REQUEST} imágenes a la vez.`, 400));
        return;
      }
      next(new AppError("No se pudo procesar la carga de archivos.", 400));
      return;
    }
    next(error);
  });
}

export { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_REQUEST };
