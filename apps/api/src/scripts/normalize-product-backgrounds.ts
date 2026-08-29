import { connectDb, disconnectDb } from "../config/db.js";
import { logger } from "../config/logger.js";
import { Accessory, Bike } from "../models/index.js";
import {
  prepareImage,
  probeStudioBackground,
  STUDIO_BACKGROUND_TARGET,
  whitenStudioBackground,
  type RgbColor,
} from "../services/storage/image-pipeline.js";
import { deleteImage, uploadImages } from "../services/storage/storage.service.js";

/**
 * One-time backfill: `whitenStudioBackground` (shipped in `3fed9a8`, the same
 * commit as this script) normalizes every *newly uploaded* bike/accessory
 * photo to `#fafafa`, but it only runs at upload time. Every asset already
 * sitting in Cloudinary was uploaded before that commit and still carries
 * whatever backdrop its source photo happened to have — measured across the
 * live library: `#f1f1f1`, `#f8f8f8`, `#fefefe`, pure `#ffffff`, each a
 * visible seam against the storefront's `bg-blanco` (`#fafafa`) frame. This
 * script re-runs the same pipeline against the existing gallery so the
 * backdrop actually matches everywhere, not just going forward.
 *
 * Idempotent — an asset already sitting at `#fafafa` survives another pass
 * unchanged (within `CONVERGENCE_TOLERANCE`), so this is safe to re-run.
 *
 *   pnpm --filter @bw-bikes/api normalize:backgrounds          # dry run (default)
 *   pnpm --filter @bw-bikes/api normalize:backgrounds -- --apply
 */

/**
 * Below this luminance, a corner reads as a dark backdrop (or no backdrop at
 * all — a logo on black, a screenshot's menu bar) rather than a light studio
 * sweep. `whitenStudioBackground`'s color-distance tolerance can separate a
 * dark *product* from a light backdrop, but it has no way to tell a dark
 * backdrop from a dark product sitting on one — so a dark corner isn't safe
 * to auto-whiten. Every real product photo in the library measured
 * luminance >= 241; the one non-photo asset that isn't a screenshot (the
 * rhino logo on black) measured 7. Set well below the former, well above the
 * latter.
 */
const DARK_LUMINANCE_THRESHOLD = 120;

/**
 * Above this corner-to-corner color distance, the four corners disagree too
 * much to be a single flat backdrop — a second product bleeding into a
 * corner, a gradient, or (the case actually found in this library) a
 * screenshot with a light menu bar and a dark app background sharing the
 * frame. Every real product photo measured <= 3; the screenshot measured
 * 281. Set well below the latter, well above the former.
 */
const CORNER_UNIFORMITY_TOLERANCE = 60;

/** How close the whitened result must land to `STUDIO_BACKGROUND_TARGET` to count as converged, rather than a gradient backdrop the proportional ramp only partly flattened. */
const CONVERGENCE_TOLERANCE = 2;

interface GalleryImageLike {
  publicId: string;
  url: string;
  width: number;
  height: number;
  alt?: string;
  color?: string;
  order: number;
}

type Action =
  | { kind: "normalize"; from: RgbColor }
  | { kind: "skip-dark"; luminance: number }
  | { kind: "skip-uneven"; maxCornerDistance: number }
  | { kind: "skip-no-converge"; result: RgbColor }
  | { kind: "already-fafafa" }
  | { kind: "error"; message: string };

interface PlanRow {
  model: "Bike" | "Accessory";
  productId: string;
  productName: string;
  publicId: string;
  action: Action;
}

const FOLDER_BY_MODEL = { Bike: "bikes", Accessory: "accessories" } as const;

function rgbDistance(a: RgbColor, b: RgbColor): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function formatRgb(c: RgbColor): string {
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
}

/** Extension Cloudinary put on the delivered URL — used only so `prepareImage`'s extension/magic-bytes cross-check doesn't false-positive; the real format is still detected from the bytes. */
function extensionFromUrl(url: string): string {
  const path = new URL(url).pathname;
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "jpg" : path.slice(dot + 1);
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} -> ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Decides what to do with one gallery image and, in `apply` mode, does it.
 * Mirrors `uploadImages`' own order for the replacement upload (new asset in
 * Cloudinary first, product document updated second, old asset deleted
 * last) so a failure mid-way orphans a Cloudinary asset — annoying but
 * cleanable — rather than ever leaving a product pointing at a dead URL.
 */
async function planImage(image: GalleryImageLike, folder: string, apply: boolean): Promise<{ action: Action; replacement?: GalleryImageLike }> {
  let original: Buffer;
  try {
    original = await downloadImage(image.url);
  } catch (error) {
    return { action: { kind: "error", message: error instanceof Error ? error.message : String(error) } };
  }

  const originalName = `${image.publicId}.${extensionFromUrl(image.url)}`;

  let prepared;
  try {
    prepared = await prepareImage(original, originalName);
  } catch (error) {
    return { action: { kind: "error", message: error instanceof Error ? error.message : String(error) } };
  }

  const probe = await probeStudioBackground(prepared.buffer);

  if (probe.luminance < DARK_LUMINANCE_THRESHOLD) {
    return { action: { kind: "skip-dark", luminance: probe.luminance } };
  }
  if (probe.maxCornerDistance > CORNER_UNIFORMITY_TOLERANCE) {
    return { action: { kind: "skip-uneven", maxCornerDistance: probe.maxCornerDistance } };
  }
  if (rgbDistance(probe.average, STUDIO_BACKGROUND_TARGET) <= CONVERGENCE_TOLERANCE) {
    return { action: { kind: "already-fafafa" } };
  }

  const whitened = await whitenStudioBackground(prepared.buffer, prepared.format);
  const resultProbe = await probeStudioBackground(whitened);

  if (rgbDistance(resultProbe.average, STUDIO_BACKGROUND_TARGET) > CONVERGENCE_TOLERANCE) {
    return { action: { kind: "skip-no-converge", result: resultProbe.average } };
  }

  if (!apply) {
    return { action: { kind: "normalize", from: probe.average } };
  }

  const [uploaded] = await uploadImages([{ buffer: original, originalname: originalName }], folder);
  if (!uploaded) {
    return { action: { kind: "error", message: "uploadImages returned no result" } };
  }

  return {
    action: { kind: "normalize", from: probe.average },
    replacement: {
      publicId: uploaded.publicId,
      url: uploaded.url,
      width: uploaded.width,
      height: uploaded.height,
      ...(image.alt !== undefined ? { alt: image.alt } : {}),
      ...(image.color !== undefined ? { color: image.color } : {}),
      order: image.order,
    },
  };
}

/**
 * Structural subset of `Bike`/`Accessory` this function actually touches.
 * `typeof Bike | typeof Accessory` isn't callable as a union — Mongoose's
 * `find` overloads don't unify across two distinct document types — so this
 * narrows to a plain interface instead; both real models satisfy it.
 */
interface GalleryBearingDocument {
  _id: unknown;
  name: string;
  gallery: GalleryImageLike[];
  save(): Promise<unknown>;
}

interface GalleryBearingModel {
  find(filter: Record<string, never>): Promise<GalleryBearingDocument[]>;
}

async function processModel(
  modelName: "Bike" | "Accessory",
  ModelClass: GalleryBearingModel,
  apply: boolean,
  rows: PlanRow[],
): Promise<void> {
  const folder = FOLDER_BY_MODEL[modelName];
  const products = await ModelClass.find({});

  for (const product of products) {
    const gallery = product.gallery as unknown as GalleryImageLike[];

    for (let i = 0; i < gallery.length; i++) {
      const image = gallery[i]!;
      const { action, replacement } = await planImage(image, folder, apply);

      rows.push({
        model: modelName,
        productId: String(product._id),
        productName: product.name,
        publicId: image.publicId,
        action,
      });

      if (replacement) {
        const oldPublicId = image.publicId;
        gallery[i] = replacement;
        // Product document first, remote delete last — see `planImage`'s
        // comment for why that order matters.
        await product.save();
        await deleteImage(oldPublicId);
      }
    }
  }
}

function printReport(rows: PlanRow[], apply: boolean): void {
  const header = apply ? "APLICADO" : "DRY RUN — nada se escribió, pasa --apply para ejecutar";
  logger.info(`\n=== normalize-product-backgrounds: ${header} ===\n`);

  for (const row of rows) {
    const label = `${row.model} "${row.productName}" (${row.productId}) — ${row.publicId}`;
    switch (row.action.kind) {
      case "normalize":
        logger.info(`${label}: normalizar ${formatRgb(row.action.from)} -> #fafafa`);
        break;
      case "already-fafafa":
        logger.info(`${label}: ya está en #fafafa, sin cambios`);
        break;
      case "skip-dark":
        logger.warn(`${label}: SALTADO — fondo oscuro (luminancia ${row.action.luminance.toFixed(0)}), no parece foto de estudio`);
        break;
      case "skip-uneven":
        logger.warn(`${label}: SALTADO — esquinas no coinciden (distancia ${row.action.maxCornerDistance.toFixed(0)}), no parece un fondo plano`);
        break;
      case "skip-no-converge":
        logger.warn(`${label}: SALTADO — no convergió a #fafafa (quedó en ${formatRgb(row.action.result)}), probable degradado`);
        break;
      case "error":
        logger.error(`${label}: ERROR — ${row.action.message}`);
        break;
    }
  }

  const toNormalize = rows.filter((r) => r.action.kind === "normalize").length;
  const skipped = rows.filter((r) => r.action.kind.startsWith("skip")).length;
  const errors = rows.filter((r) => r.action.kind === "error").length;
  const alreadyOk = rows.filter((r) => r.action.kind === "already-fafafa").length;

  logger.info(
    `\nTotal: ${rows.length} imágenes — ${toNormalize} ${apply ? "normalizadas" : "por normalizar"}, ${alreadyOk} ya en #fafafa, ${skipped} saltadas, ${errors} con error.\n`,
  );
}

async function run(): Promise<void> {
  const apply = process.argv.includes("--apply");

  await connectDb();
  try {
    const rows: PlanRow[] = [];
    await processModel("Bike", Bike, apply, rows);
    await processModel("Accessory", Accessory, apply, rows);
    printReport(rows, apply);
  } finally {
    await disconnectDb();
  }
}

run().catch((error) => {
  logger.error({ err: error }, "[normalize-product-backgrounds] Fallo inesperado");
  process.exitCode = 1;
});
