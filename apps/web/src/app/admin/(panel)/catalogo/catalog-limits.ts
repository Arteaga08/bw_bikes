/**
 * Small, dependency-free constants shared between a heavy step component and
 * `ProductEditor.tsx` — split out so `ProductEditor` can read a limit like
 * `MAX_GALLERY_IMAGES` (e.g. for a step's progress counter) without a
 * *static* import of the step's own 400+-line module, which would force
 * that whole module into the editor's main bundle regardless of the
 * `next/dynamic` import used to actually render it. Add a value here only
 * when a step's component needs it internally too — see `MAX_GALLERY_IMAGES`
 * in `GallerySection.tsx`.
 */

/** Mirrors `MAX_GALLERY_IMAGES` in `apps/api/src/models/schemas/product-image.schema.ts`. */
export const MAX_GALLERY_IMAGES = 15;
