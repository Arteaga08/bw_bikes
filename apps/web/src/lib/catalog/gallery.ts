import type { ProductImage } from "@bw-bikes/shared";

/**
 * Moves the image at `from` to `to`, shifting everything between them —
 * shared by the up/down icon buttons and the drag-to-reorder handler, so
 * both routes to the same action produce the exact same array. Out-of-range
 * targets clamp to the nearest valid index instead of throwing: a drop past
 * the last card is "move to the end", not an error.
 */
export function moveImage(gallery: ProductImage[], from: number, to: number): ProductImage[] {
  const clampedTo = Math.min(Math.max(to, 0), gallery.length - 1);
  if (from === clampedTo) return gallery;

  const next = [...gallery];
  const [moved] = next.splice(from, 1);
  next.splice(clampedTo, 0, moved as ProductImage);
  return next;
}
