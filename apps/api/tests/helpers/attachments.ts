/**
 * A minimal, real PDF buffer — valid enough to satisfy the magic-byte check
 * (`%PDF-` header) that `attachment-pipeline.ts` performs. Nothing here
 * decodes the PDF further, so a hand-built minimal document is genuine input
 * for the code under test, the same reasoning as `images.ts`'s generated
 * image buffers.
 */
export function makePdfBuffer(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
      "trailer<</Root 1 0 R>>\n%%EOF",
    "utf8",
  );
}
