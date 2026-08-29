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
 * The EXIF-strip + dimension-cap step, split out from `prepareImage` so
 * `attachment-pipeline.ts` (M6) can reuse it for the image branch of an
 * application attachment without redoing signature detection — by the time
 * either caller reaches this, the format is already known good.
 */
export async function normalizeImageBuffer(buffer: Buffer, originalName: string): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({ width: MAX_STORED_EDGE, height: MAX_STORED_EDGE, fit: "inside", withoutEnlargement: true })
      .toBuffer();
  } catch {
    // Header said "PNG" but the body doesn't decode — a truncated upload or a
    // file with a grafted-on signature. Same 400 either way.
    throw new AppError(`El archivo "${originalName}" está dañado o no se pudo procesar.`, 400);
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

  const normalized = await normalizeImageBuffer(buffer, originalName);
  return { buffer: normalized, format };
}

// --- Studio background normalization ----------------------------------------
//
// Two folder-gated treatments, wired up in `storage.service.ts#uploadImages`
// (never here — this module stays folder-agnostic): `whitenStudioBackground`
// for product photography (`bikes`/`accessories`), `punchLogoTransparency`
// for brand logos (`brands`). Neither applies to lifestyle photography (hero,
// categories, home tiles, branch, bike-of-month) — a "cleaned" background
// there would be wrong, not an improvement.
//
// Both share the same technique: average the four corner squares to estimate
// the studio backdrop color, then treat every pixel within a color-distance
// tolerance of that estimate as background. A color-distance threshold
// (not a plain brightness/levels stretch) is what keeps a black product on a
// light backdrop from getting crushed — a dark tire or a black-on-white
// wordmark reads as *far* from the sampled background color regardless of
// how bright the actual backdrop is. Validated against real uploaded assets
// (a tire's gradient studio backdrop, a matte-black helmet, an opaque brand
// logo) via `impeccable` before shipping: ~60ms for a 1280x1280 product
// photo, ~6ms for a logo — both run once at upload time, never on a
// storefront render, so neither touches shopper-facing performance.

/** Corner square (px) sampled per corner to estimate the studio backdrop color. */
const BACKGROUND_SAMPLE_EDGE = 24;

/**
 * sRGB Euclidean color distance (0–441) under which a product photo's pixel
 * is treated as backdrop. Wide enough to catch a soft gradient/shadow
 * backdrop; narrow enough that a light-colored product survives.
 */
const PRODUCT_BACKGROUND_TOLERANCE = 40;

/**
 * Tighter than the product tolerance: a logo's backdrop is flat, uploaded
 * artwork rather than photographed, so a smaller tolerance already catches
 * all of it without eating soft-edged ink.
 */
const LOGO_ALPHA_TOLERANCE = 30;

/**
 * The backdrop target: `--color-blanco` (`apps/web/src/app/globals.css`,
 * `#fafafa`), not pure `#ffffff`. Every surface a product photo actually
 * sits against on the storefront — the home rail's frame, the catalog
 * page's floor — is that same "blanco" token. Targeting pure white left a
 * ~2% brightness seam around every photo, visible against `bg-blanco` even
 * though the frame and the page shared the same class — caught visually,
 * via `impeccable`, after shipping the first version of this function.
 */
export const STUDIO_BACKGROUND_TARGET: RgbColor = { r: 250, g: 250, b: 250 };

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** Average color of one corner square. */
function averageCorner(
  data: Buffer,
  width: number,
  channels: number,
  cornerX: number,
  cornerY: number,
  edge: number,
): RgbColor {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let y = cornerY; y < cornerY + edge; y++) {
    for (let x = cornerX; x < cornerX + edge; x++) {
      const idx = (y * width + x) * channels;
      sumR += data[idx]!;
      sumG += data[idx + 1]!;
      sumB += data[idx + 2]!;
      count += 1;
    }
  }

  return { r: sumR / count, g: sumG / count, b: sumB / count };
}

/** The four corner squares individually — callers that need to tell a flat backdrop from an uneven one (a second product, a gradient) read these before trusting their average. */
function sampleCorners(data: Buffer, width: number, height: number, channels: number): RgbColor[] {
  const edge = Math.max(1, Math.min(BACKGROUND_SAMPLE_EDGE, Math.floor(width / 4), Math.floor(height / 4)));
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - edge, 0],
    [0, height - edge],
    [width - edge, height - edge],
  ];

  return corners.map(([cornerX, cornerY]) => averageCorner(data, width, channels, cornerX, cornerY, edge));
}

/** Average color of the four corner squares — the studio backdrop, assuming the subject doesn't touch a corner. */
function sampleCornerBackground(data: Buffer, width: number, height: number, channels: number): RgbColor {
  const corners = sampleCorners(data, width, height, channels);
  const sum = corners.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }), { r: 0, g: 0, b: 0 });
  return { r: sum.r / corners.length, g: sum.g / corners.length, b: sum.b / corners.length };
}

function rgbDistance(a: RgbColor, b: RgbColor): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/** Perceptual luminance (ITU-R BT.601), 0–255. Cheap stand-in for "is this corner dark" without a full colorimetric conversion. */
function luminance(c: RgbColor): number {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

export interface StudioBackgroundProbe {
  /** The four corner squares, in the same order `sampleCorners` produces them. */
  corners: RgbColor[];
  /** Their average — what `whitenStudioBackground` treats as the backdrop. */
  average: RgbColor;
  /** Largest pairwise distance between corners. High means the four corners disagree — not a single flat backdrop (a second product corner-to-corner, a gradient, a lifestyle photo). */
  maxCornerDistance: number;
  /** Luminance of the averaged corner. Low means a dark backdrop — `whitenStudioBackground`'s color-distance tolerance can't tell "dark backdrop" from "dark product" the way it tells a light one apart, so a dark corner isn't safe to auto-whiten. */
  luminance: number;
}

/**
 * Read-only counterpart to `whitenStudioBackground`: samples the same four
 * corners without touching a single pixel, for a caller that needs to decide
 * *whether* an image is a normal studio photo before running the (partially
 * destructive) whitening pass on it — the backfill script in
 * `scripts/normalize-product-backgrounds.ts` is the first one.
 */
export async function probeStudioBackground(buffer: Buffer): Promise<StudioBackgroundProbe> {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const corners = sampleCorners(data, width, height, channels);
  const average = corners.reduce(
    (acc, c) => ({ r: acc.r + c.r / corners.length, g: acc.g + c.g / corners.length, b: acc.b + c.b / corners.length }),
    { r: 0, g: 0, b: 0 },
  );
  let maxCornerDistance = 0;
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      maxCornerDistance = Math.max(maxCornerDistance, rgbDistance(corners[i]!, corners[j]!));
    }
  }

  return { corners, average, maxCornerDistance, luminance: luminance(average) };
}

/**
 * Blends every pixel within `PRODUCT_BACKGROUND_TOLERANCE` of the sampled
 * backdrop color toward `STUDIO_BACKGROUND_TARGET` ("nuestro blanco"),
 * proportional to how close it is — a smooth ramp near the tolerance edge,
 * not a hard cutoff, so a soft photographed shadow fades out instead of
 * leaving a visible ring.
 *
 * Re-encodes to `format` (the buffer's own format, from `prepareImage`) —
 * this stays a photographic re-encode, never a format change.
 */
export async function whitenStudioBackground(buffer: Buffer, format: ImageFormat): Promise<Buffer> {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const bg = sampleCornerBackground(data, width, height, channels);
  const out = Buffer.from(data);

  for (let i = 0; i < data.length; i += channels) {
    const dr = data[i]! - bg.r;
    const dg = data[i + 1]! - bg.g;
    const db = data[i + 2]! - bg.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    const whiteness = Math.max(0, Math.min(1, (PRODUCT_BACKGROUND_TOLERANCE - distance) / PRODUCT_BACKGROUND_TOLERANCE));

    if (whiteness > 0) {
      out[i] = data[i]! + (STUDIO_BACKGROUND_TARGET.r - data[i]!) * whiteness;
      out[i + 1] = data[i + 1]! + (STUDIO_BACKGROUND_TARGET.g - data[i + 1]!) * whiteness;
      out[i + 2] = data[i + 2]! + (STUDIO_BACKGROUND_TARGET.b - data[i + 2]!) * whiteness;
    }
  }

  return sharp(out, { raw: { width, height, channels } }).toFormat(format).toBuffer();
}

/**
 * Replaces the sampled backdrop color with real alpha transparency instead of
 * a solid fill — a brand logo is composited on more than one background
 * across the site (the storefront's dark `HomeBrands` marquee, the admin
 * panel's light surfaces), and a fill baked toward either one would be wrong
 * on the other. Real transparency also unblocks `isLogoDarkOnTransparent`
 * (`apps/web/src/lib/catalog/logo-luminance.ts`), which already inverts a
 * dark-on-transparent logo for the marquee but requires genuine alpha to
 * trigger — an opaque PNG with a solid backdrop never qualified.
 *
 * Always re-encodes to PNG regardless of the source format: alpha needs a
 * format that supports it (JPEG never does), and PNG's lossless encoding
 * keeps a wordmark's edges crisp in a way WebP's lossy default wouldn't.
 */
export async function punchLogoTransparency(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const bg = sampleCornerBackground(data, width, height, channels);
  const out = Buffer.alloc(width * height * 4);

  for (let i = 0, j = 0; i < data.length; i += channels, j += 4) {
    const dr = data[i]! - bg.r;
    const dg = data[i + 1]! - bg.g;
    const db = data[i + 2]! - bg.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    const alpha = Math.max(0, Math.min(255, Math.round((distance / LOGO_ALPHA_TOLERANCE) * 255)));

    out[j] = data[i]!;
    out[j + 1] = data[i + 1]!;
    out[j + 2] = data[i + 2]!;
    out[j + 3] = alpha;
  }

  return sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}
