import {
  ACCEPTED_ATTACHMENT_FORMATS,
  type AttachmentFormat,
  AppError,
  detectAttachmentFormat,
} from "../../utils/index.js";
import { normalizeImageBuffer } from "./image-pipeline.js";

export interface PreparedAttachment {
  buffer: Buffer;
  format: AttachmentFormat;
}

const FORMAT_LABELS: Record<AttachmentFormat, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  avif: "AVIF",
  pdf: "PDF",
};

/** Every spelling of a format the client may declare, by real format. */
const FORMAT_ALIASES: Record<AttachmentFormat, readonly string[]> = {
  jpeg: ["jpeg", "jpg", "jpe", "image/jpeg", "image/jpg"],
  png: ["png", "image/png"],
  webp: ["webp", "image/webp"],
  avif: ["avif", "image/avif"],
  pdf: ["pdf", "application/pdf"],
};

function declaredMatchesReal(declared: string, real: AttachmentFormat): boolean {
  return FORMAT_ALIASES[real].includes(declared.toLowerCase());
}

/**
 * Same rule as the catalog gallery's `assertDeclaredTypeMatches`, extended to
 * PDF: the rejection is a **contradiction** between what the client declared
 * (extension, `Content-Type`) and what the bytes actually are, not merely "is
 * this a format we don't accept" — a `.jpg` that is really a PDF is refused
 * for the same reason a PDF renamed to `.jpg` is.
 */
function assertDeclaredTypeMatches(real: AttachmentFormat, originalName: string, mimetype?: string): void {
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
 * Validates an ambassador/sponsorship application attachment. Same shape as
 * `prepareImage` (magic bytes → declared-type contradiction), but branches on
 * the real format for the last step:
 *
 * - An **image** goes through the exact same EXIF-strip + dimension cap as
 *   the catalog gallery (`normalizeImageBuffer`) — an applicant's photo
 *   deserves the same privacy treatment as a product photo.
 * - A **PDF** is stored as-is. There is no metadata-stripping step for PDFs
 *   here (out of scope for this milestone) and no image pipeline applies to
 *   a document.
 */
export async function prepareAttachment(
  buffer: Buffer,
  originalName: string,
  mimetype?: string,
): Promise<PreparedAttachment> {
  const format = detectAttachmentFormat(buffer);

  if (!format) {
    throw new AppError(
      `El archivo "${originalName}" no es un formato válido. Formatos aceptados: ${ACCEPTED_ATTACHMENT_FORMATS.map((f) => FORMAT_LABELS[f]).join(", ")}.`,
      400,
    );
  }

  assertDeclaredTypeMatches(format, originalName, mimetype);

  if (format === "pdf") {
    return { buffer, format };
  }

  const normalized = await normalizeImageBuffer(buffer, originalName);
  return { buffer: normalized, format };
}
