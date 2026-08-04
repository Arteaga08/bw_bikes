import sharp from "sharp";
import { ACCEPTED_IMAGE_FORMATS, AppError, detectImageFormat, type ImageFormat } from "../../utils/index.js";

/**
 * Largest edge kept for the stored original. Cloudinary derives every
 * delivered size from it (see `buildImageUrl`), so there's no reason to keep a
 * 6000px camera original around — but there is a reason not to: it costs
 * storage and bandwidth on every derivation.
 */
const MAX_STORED_EDGE = 2400;

export interface PreparedImage {
  buffer: Buffer;
  format: ImageFormat;
}

const FORMAT_LABELS: Record<ImageFormat, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  avif: "AVIF",
};

/** Every spelling of a format the client may declare, by real format. */
const FORMAT_ALIASES: Record<ImageFormat, readonly string[]> = {
  jpeg: ["jpeg", "jpg", "jpe", "image/jpeg", "image/jpg"],
  png: ["png", "image/png"],
  webp: ["webp", "image/webp"],
  avif: ["avif", "image/avif"],
};

function declaredMatchesReal(declared: string, real: ImageFormat): boolean {
  return FORMAT_ALIASES[real].includes(declared.toLowerCase());
}

/**
 * Rejects a file whose declared identity contradicts its actual bytes — a PNG
 * presented as `foto.jpg` / `image/jpeg`.
 *
 * Note this is a *second*, stricter rule on top of signature detection, and
 * it's the one the milestone's acceptance criterion names explicitly. Content
 * detection alone would happily accept that file (a PNG is a format we serve),
 * but a mismatch is never something a well-behaved client produces: it means
 * the file was renamed by hand or the request was crafted. Refusing it keeps
 * the stored extension, the delivered Content-Type and the actual bytes in
 * agreement, so nothing downstream ever has to guess which one to trust.
 */
function assertDeclaredTypeMatches(real: ImageFormat, originalName: string, mimetype?: string): void {
  const extension = originalName.includes(".") ? originalName.split(".").pop()! : "";

  const contradictions = [mimetype, extension].filter(
    (declared): declared is string => Boolean(declared) && !declaredMatchesReal(declared!, real),
  );

  if (contradictions.length > 0) {
    throw new AppError(
      `El archivo "${originalName}" dice ser un formato distinto al que realmente es (${FORMAT_LABELS[real]}). Vuelve a guardarlo con su extensión correcta.`,
      400,
    );
  }
}

/**
 * Validates and normalizes an uploaded buffer before anything is sent to
 * Cloudinary. Three steps, in this order:
 *
 * 1. **Magic bytes.** The real format is read from the file's own header —
 *    never from the extension or the declared `Content-Type`, both of which
 *    the client controls. A file that matches no known signature is rejected
 *    outright.
 * 2. **Declared type must agree with the real one.** See
 *    `assertDeclaredTypeMatches`: a PNG uploaded as `foto.jpg` is refused.
 * 3. **EXIF strip + orientation.** `rotate()` bakes the EXIF orientation into
 *    the pixels, then the re-encode drops all metadata. Camera EXIF carries GPS
 *    coordinates and device identifiers — publishing a product photo should not
 *    publish the workshop's address (ECOMMERCE_ARCHITECTURE_GUIDELINES.md
 *    §"Red/salida", §"Privacidad").
 * 4. **Dimension cap**, without upscaling smaller images.
 *
 * Deliberately *not* done here: compression for delivery. That happens at
 * request time via Cloudinary's `f_auto`/`q_auto`, so each slot gets the format
 * and quality that fits it instead of one lossy guess baked in at upload.
 */
export async function prepareImage(
  buffer: Buffer,
  originalName: string,
  mimetype?: string,
): Promise<PreparedImage> {
  const format = detectImageFormat(buffer);

  if (!format) {
    throw new AppError(
      `El archivo "${originalName}" no es una imagen válida. Formatos aceptados: ${ACCEPTED_IMAGE_FORMATS.map((f) => FORMAT_LABELS[f]).join(", ")}.`,
      400,
    );
  }

  assertDeclaredTypeMatches(format, originalName, mimetype);

  try {
    const normalized = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_STORED_EDGE, height: MAX_STORED_EDGE, fit: "inside", withoutEnlargement: true })
      .toBuffer();

    return { buffer: normalized, format };
  } catch {
    // Header said "PNG" but the body doesn't decode — a truncated upload or a
    // file with a grafted-on signature. Same 400 either way.
    throw new AppError(`El archivo "${originalName}" está dañado o no se pudo procesar.`, 400);
  }
}
