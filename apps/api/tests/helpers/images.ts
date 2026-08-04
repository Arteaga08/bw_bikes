import sharp from "sharp";

/**
 * Real, decodable image buffers generated at test time rather than checked-in
 * fixtures. The point of the upload tests is that the *bytes* are inspected,
 * so the bytes have to be genuine — a hand-written "PNG-ish" constant would
 * pass the signature check and then fail to decode, testing the wrong thing.
 */

const TINY = { width: 12, height: 8, channels: 3 as const, background: { r: 20, g: 20, b: 20 } };

export function makePngBuffer(): Promise<Buffer> {
  return sharp({ create: TINY }).png().toBuffer();
}

export function makeJpegBuffer(): Promise<Buffer> {
  return sharp({ create: TINY }).jpeg().toBuffer();
}

export function makeWebpBuffer(): Promise<Buffer> {
  return sharp({ create: TINY }).webp().toBuffer();
}

/**
 * A plain text file. Neither its extension nor its declared mimetype is what
 * gets it rejected — its first bytes match no image signature.
 */
export function makeTextBuffer(): Buffer {
  return Buffer.from("not an image, just text pretending to be one", "utf8");
}
