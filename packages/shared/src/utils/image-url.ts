/**
 * Options for a derived (transformed) Cloudinary delivery URL. Every field is
 * optional — omitting all of them yields the original asset with automatic
 * format and quality, which is already the right default for most slots.
 */
export interface ImageUrlOptions {
  /** Target width in CSS pixels. Cloudinary generates and caches that derivative on first request. */
  width?: number;
  /** `"auto"` lets Cloudinary pick per-image; a number (1-100) pins it. */
  quality?: number | "auto";
  /** `"auto"` negotiates AVIF/WebP/JPEG from the browser's Accept header. */
  format?: "auto" | "webp" | "avif" | "jpg";
  /** How the image is fitted into `width` when it doesn't match the original aspect. */
  crop?: "fill" | "fit" | "limit";
}

/**
 * Single source of truth for building Cloudinary delivery URLs, shared by the
 * API and the storefront so neither hand-rolls transformation strings.
 *
 * The database stores a `publicId`, never a baked URL — that is precisely what
 * makes a responsive `srcset` possible: the same original can be requested at
 * five widths without re-uploading anything. Compression is not done by the
 * API at upload time; it happens here, at delivery, via `f_auto` (serve AVIF
 * or WebP when the browser accepts it) and `q_auto` (per-image quality that
 * typically cuts 40-60% of the bytes with no visible difference).
 *
 * `cloudName` is passed in rather than read from env because this module is
 * consumed from both sides of the monorepo: the API has `env.cloudinaryCloudName`,
 * the browser has `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
 */
export function buildImageUrl(cloudName: string, publicId: string, options: ImageUrlOptions = {}): string {
  const { width, quality = "auto", format = "auto", crop = "limit" } = options;

  const transformations = [`f_${format}`, `q_${quality}`];
  if (width !== undefined) {
    transformations.push(`w_${Math.round(width)}`, `c_${crop}`);
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations.join(",")}/${publicId}`;
}

/**
 * Widths used to build a responsive `srcset` for a product gallery. Chosen to
 * cover a phone at 1x through a desktop lightbox at 2x without generating a
 * derivative per arbitrary viewport.
 */
export const RESPONSIVE_IMAGE_WIDTHS = [400, 800, 1200, 1600, 2400] as const;
