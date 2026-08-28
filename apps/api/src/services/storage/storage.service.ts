import type { UploadApiResponse } from "cloudinary";
import { CLOUDINARY_ROOT_FOLDER, cloudinary } from "../../config/cloudinary.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import type { AttachmentFormat } from "../../utils/index.js";
import { AppError } from "../../utils/index.js";
import { prepareAttachment } from "./attachment-pipeline.js";
import { prepareImage, punchLogoTransparency, whitenStudioBackground } from "./image-pipeline.js";

export interface UploadedImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
}

export interface UploadableFile {
  buffer: Buffer;
  originalname: string;
  /** As declared by the client. Only used to detect a contradiction with the real bytes. */
  mimetype?: string;
}

/**
 * The only module in the codebase that talks to Cloudinary. Controllers and
 * business services depend on this narrow surface (`uploadImages` /
 * `deleteImage`), never on the SDK — so swapping the provider, or adding a
 * second one, touches this file alone.
 */

function uploadBuffer(buffer: Buffer, folder: string): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        // The stored asset is the source of truth; every delivered variant is
        // derived from it at request time via buildImageUrl's transformations.
        overwrite: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary returned no result"));
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

/**
 * Validates every file first, then uploads. The two passes are separate on
 * purpose: a batch with one forged file is rejected whole, instead of leaving
 * half the images uploaded and the request failed.
 */
/**
 * Refuses the operation outright when Cloudinary has no credentials, instead
 * of letting the SDK fail with an opaque auth error. Only reachable outside
 * production — `loadEnv()` won't let a production process start unconfigured.
 *
 * This is a hard failure on purpose, never a fake success: nothing in this
 * codebase pretends an image was stored when it wasn't.
 */
function assertConfigured(): void {
  if (!env.isCloudinaryConfigured) {
    throw new AppError(
      "La galería no está disponible: falta configurar Cloudinary en este entorno.",
      503,
    );
  }
}

/** Product studio photography — gets its backdrop whitened. Matches the `CLOUDINARY_FOLDER` each controller passes to `uploadImages`. */
const STUDIO_BACKGROUND_FOLDERS = new Set(["bikes", "accessories"]);

/** Brand logos — get their backdrop punched to real alpha transparency instead. */
const LOGO_TRANSPARENCY_FOLDER = "brands";

export async function uploadImages(files: UploadableFile[], folder: string): Promise<UploadedImage[]> {
  assertConfigured();

  const prepared = await Promise.all(
    files.map((file) => prepareImage(file.buffer, file.originalname, file.mimetype)),
  );

  const processed = await Promise.all(
    prepared.map(async (image) => {
      if (STUDIO_BACKGROUND_FOLDERS.has(folder)) {
        return { ...image, buffer: await whitenStudioBackground(image.buffer, image.format) };
      }
      if (folder === LOGO_TRANSPARENCY_FOLDER) {
        return { ...image, buffer: await punchLogoTransparency(image.buffer) };
      }
      return image;
    }),
  );

  const destination = `${CLOUDINARY_ROOT_FOLDER}/${folder}`;

  try {
    const results = await Promise.all(processed.map((image) => uploadBuffer(image.buffer, destination)));

    return results.map((result) => ({
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
    }));
  } catch (error) {
    logger.error({ err: error, folder: destination }, "Cloudinary upload failed");
    throw new AppError("No se pudo subir la imagen. Intenta de nuevo.", 502);
  }
}

/**
 * Best-effort remote delete. The image is already gone from the product
 * document by the time this runs, so a failure here orphans an asset in the
 * media library — annoying and cleanable, unlike the alternative of a product
 * pointing at a URL that no longer resolves.
 */
export async function deleteImage(publicId: string): Promise<void> {
  if (!env.isCloudinaryConfigured) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    logger.error({ err: error, publicId }, "Cloudinary delete failed; asset may be orphaned");
  }
}

// --- Application attachments (M6) ------------------------------------------
//
// A separate upload path from the catalog gallery: an ambassador or event
// sponsorship attachment may be a PDF, and — unlike a product photo, which is
// meant to be public — it belongs to a real person or a third party's event
// proposal, so it is stored under Cloudinary's `authenticated` delivery type
// rather than the gallery's plain public one.

export interface UploadedAttachment {
  publicId: string;
  format: AttachmentFormat;
}

export interface UploadableAttachment {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
}

function assertAttachmentsConfigured(): void {
  if (!env.isCloudinaryConfigured) {
    throw new AppError("Los adjuntos no están disponibles: falta configurar Cloudinary en este entorno.", 503);
  }
}

/** PDFs are not images, so Cloudinary has to be told to treat them as a raw asset. */
function resourceTypeFor(format: AttachmentFormat): "image" | "raw" {
  return format === "pdf" ? "raw" : "image";
}

function uploadAttachmentBuffer(buffer: Buffer, folder: string, format: AttachmentFormat): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceTypeFor(format),
        // Private delivery: see `buildSignedAttachmentUrl` for what this buys.
        type: "authenticated",
        overwrite: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary returned no result"));
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

/** Same two-pass shape as `uploadImages`: validate every file before uploading any of them. */
export async function uploadAttachments(files: UploadableAttachment[], folder: string): Promise<UploadedAttachment[]> {
  assertAttachmentsConfigured();

  const prepared = await Promise.all(
    files.map((file) => prepareAttachment(file.buffer, file.originalname, file.mimetype)),
  );

  const destination = `${CLOUDINARY_ROOT_FOLDER}/${folder}`;

  try {
    const results = await Promise.all(
      prepared.map((file) => uploadAttachmentBuffer(file.buffer, destination, file.format)),
    );

    return results.map((result, index) => ({ publicId: result.public_id, format: prepared[index]!.format }));
  } catch (error) {
    logger.error({ err: error, folder: destination }, "Cloudinary attachment upload failed");
    throw new AppError("No se pudo subir el archivo. Intenta de nuevo.", 502);
  }
}

/**
 * A signed URL for a privately-stored attachment. `type: "authenticated"` at
 * upload time means the plain public URL a gallery image would have simply
 * refuses the request; only a request carrying this signature resolves.
 *
 * This is a signed link, not yet a **time-limited** one — a hard expiry needs
 * an `auth_token` signing key configured on the Cloudinary account, which is
 * a follow-up if that stronger guarantee is wanted. What this already
 * guarantees: the URL cannot be guessed or enumerated from the stored
 * `publicId` alone, which is the property that matters for a document that
 * names a real person or a third party's event.
 */
export function buildSignedAttachmentUrl(publicId: string, format: AttachmentFormat): string {
  assertAttachmentsConfigured();

  return cloudinary.url(publicId, {
    resource_type: resourceTypeFor(format),
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
}
