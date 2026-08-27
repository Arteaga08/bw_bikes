import type { PublicHomeTile } from "@bw-bikes/shared";
import { PhotoCtaTile } from "@/components/storefront/shared/PhotoCtaTile";

export interface HomeCategoryCtaTileProps {
  tile: PublicHomeTile;
  label: string;
  href: string;
  corner: "left" | "right";
}

/**
 * Thin adapter over `PhotoCtaTile`: maps the admin-managed `PublicHomeTile`
 * shape (and its internal catalog destination) onto the shared tile design.
 * See `PhotoCtaTile` for the actual markup.
 */
export function HomeCategoryCtaTile({ tile, label, href, corner }: HomeCategoryCtaTileProps) {
  return <PhotoCtaTile image={tile.image} label={label} href={href} rhinoCorner={corner} />;
}
