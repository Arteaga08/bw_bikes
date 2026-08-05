import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import { AppError } from "../utils/index.js";

/** 10 MB per file — a scanned sponsorship proposal PDF runs larger than a product photo. */
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Enough for a handful of supporting photos or a proposal document plus a couple of images. */
const MAX_ATTACHMENTS_PER_REQUEST = 5;

/**
 * Same shape as `upload-images.ts`: memory storage, hard limits, and
 * deliberately **no `fileFilter`** — the declared `Content-Type` and filename
 * are client-supplied and prove nothing. The real check is
 * `prepareAttachment`'s magic-byte inspection
 * (services/storage/attachment-pipeline.ts), which runs before a single byte
 * reaches Cloudinary. A separate multer instance from `upload-images.ts`
 * because the field name (`attachments`, not `images`) and the limits differ.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES, files: MAX_ATTACHMENTS_PER_REQUEST },
});

const receiveFiles = upload.array("attachments", MAX_ATTACHMENTS_PER_REQUEST);

/** Wraps multer so its errors become operational `AppError`s with Spanish copy. */
export function uploadAttachments(req: Request, res: Response, next: NextFunction): void {
  receiveFiles(req, res, (error: unknown) => {
    if (error instanceof MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(new AppError(`Cada archivo debe pesar menos de ${MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)} MB.`, 400));
        return;
      }
      if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
        next(new AppError(`No se pueden adjuntar más de ${MAX_ATTACHMENTS_PER_REQUEST} archivos a la vez.`, 400));
        return;
      }
      next(new AppError("No se pudo procesar la carga de archivos.", 400));
      return;
    }
    next(error);
  });
}

export { MAX_ATTACHMENT_SIZE_BYTES, MAX_ATTACHMENTS_PER_REQUEST };
