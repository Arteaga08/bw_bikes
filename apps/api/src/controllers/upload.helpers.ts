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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeInPlace(target: unknown): void {
  if (Array.isArray(target)) {
    for (const item of target) sanitizeInPlace(item);
    return;
  }
  if (!isPlainObject(target)) return;

  for (const key of Object.keys(target)) {
    const value = target[key];
    if (typeof value === "string") {
      target[key] = filterXSS(value);
    } else {
      sanitizeInPlace(value);
    }
  }
}

/**
 * XSS-escapes every string field multer parsed, recursing into nested
 * objects and arrays (a `socialLinks[0]` or a details sub-object, e.g. M6's
 * application forms) — not just the top-level keys. Called after `validate`,
 * before the service.
 */
export function sanitizeMultipartBody(req: Request): void {
  sanitizeInPlace(req.body);
}

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

function narrowFiles(req: Request): UploadedFile[] {
  const files = req.files;
  if (!Array.isArray(files)) return [];

  // `mimetype` is forwarded only so the pipeline can catch it *contradicting*
  // the real bytes — it is never trusted as evidence of the format.
  return files.map((file) => ({
    buffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
  }));
}

/** Narrows multer's `req.files` and rejects a request that carried no file at all. */
export function readUploadedFiles(req: Request): UploadedFile[] {
  const files = narrowFiles(req);
  if (files.length === 0) {
    throw new AppError("Envía al menos una imagen.", 400);
  }
  return files;
}

/**
 * Same narrowing, without the "at least one" requirement — the application
 * forms' attachments are optional (a text-only sponsorship pitch is a valid
 * submission).
 */
export function readOptionalUploadedFiles(req: Request): UploadedFile[] {
  return narrowFiles(req);
}
