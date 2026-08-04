/**
 * Image type detection by **magic bytes**, per
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"Red/salida" and
 * BACKEND_SECURITY_GUIDELINES.md §8.
 *
 * Neither the file extension nor the declared `Content-Type` is evidence of
 * anything: both are supplied by the client and both are trivially forged by
 * renaming `payload.png` to `foto.jpg`. The first bytes of the file are the
 * only part the format itself defines, so that is what gets checked before a
 * single byte leaves for Cloudinary.
 */

export type ImageFormat = "jpeg" | "png" | "webp" | "avif";

interface Signature {
  format: ImageFormat;
  /** Byte offset where `bytes` must appear. */
  offset: number;
  /** `null` marks a position whose value is irrelevant (e.g. a length field). */
  bytes: readonly (number | null)[];
}

const SIGNATURES: readonly Signature[] = [
  // SOI marker + the start of the first APPn/DQT segment.
  { format: "jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  // \x89 P N G \r \n \x1a \n — the full 8-byte PNG signature, including the
  // CRLF/EOF bytes that exist specifically to detect mangled transfers.
  { format: "png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // RIFF container: "RIFF" .... "WEBP" — bytes 4-7 are the file size, ignored.
  {
    format: "webp",
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
  // ISO-BMFF box: 4-byte box size, then "ftypavif".
  {
    format: "avif",
    offset: 0,
    bytes: [null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
  },
];

function matches(buffer: Buffer, signature: Signature): boolean {
  const end = signature.offset + signature.bytes.length;
  if (buffer.length < end) return false;

  return signature.bytes.every((byte, index) => byte === null || buffer[signature.offset + index] === byte);
}

/**
 * Returns the real format of `buffer`, or `null` when it matches none of the
 * accepted signatures. `null` is the reject case — callers must never fall
 * back to the declared mimetype when this returns nothing.
 */
export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  return SIGNATURES.find((signature) => matches(buffer, signature))?.format ?? null;
}

/** Formats the gallery endpoints accept, for building user-facing messages. */
export const ACCEPTED_IMAGE_FORMATS: readonly ImageFormat[] = ["jpeg", "png", "webp", "avif"];
