import type { UploadApiResponse } from "cloudinary";
import { CLOUDINARY_ROOT_FOLDER, cloudinary } from "../../config/cloudinary.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../utils/index.js";
import { prepareImage } from "./image-pipeline.js";

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

export async function uploadImages(files: UploadableFile[], folder: string): Promise<UploadedImage[]> {
  assertConfigured();

  const prepared = await Promise.all(
    files.map((file) => prepareImage(file.buffer, file.originalname, file.mimetype)),
  );

  const destination = `${CLOUDINARY_ROOT_FOLDER}/${folder}`;

  try {
    const results = await Promise.all(prepared.map((image) => uploadBuffer(image.buffer, destination)));

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
