import type { Request } from "express";
import { filterXSS } from "xss";
import { AppError } from "../utils/index.js";

/**
 * Text fields that ride along with a file upload arrive as
 * `multipart/form-data`, which `express.json()` doesn't parse and therefore
 * the global `sanitizeInput` middleware never sees — it runs before multer has
 * populated `req.body`. These two helpers close that gap on the upload routes
 * themselves, which is the explicit remedy called for in
 * BACKEND_SECURITY_GUIDELINES.md §5 and already flagged in the comment on
 * `middlewares/sanitize-input.ts`.
 */

/** XSS-escapes every string field multer parsed. Called after `validate`, before the service. */
export function sanitizeMultipartBody(req: Request): void {
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object") return;

  for (const key of Object.keys(body)) {
    const value = body[key];
    if (typeof value === "string") {
      body[key] = filterXSS(value);
    }
  }
}

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/** Narrows multer's `req.files` and rejects a request that carried no file at all. */
export function readUploadedFiles(req: Request): UploadedFile[] {
  const files = req.files;

  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError("Envía al menos una imagen.", 400);
  }

  // `mimetype` is forwarded only so the pipeline can catch it *contradicting*
  // the real bytes — it is never trusted as evidence of the format.
  return files.map((file) => ({
    buffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
  }));
}
