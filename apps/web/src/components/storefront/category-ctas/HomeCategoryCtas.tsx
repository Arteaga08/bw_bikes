import type { PublicHomeTile } from "@bw-bikes/shared";
import { publicApiFetch } from "@/lib/api/public";
import { ApiError } from "@/lib/api/error";
import { HomeCategoryCtaCarousel } from "./HomeCategoryCtaCarousel";

/**
 * Server Component: the home's "comprar bicis/accesorios" section (M12,
 * entrega 6/10) — two large photo tiles, referenced from specialized.com's
 * home. Same fetch/degrade contract as `HomeCategories`/`HomeBrands`: a slot
 * with no uploaded photo just doesn't render, and if neither slot has one the
 * whole section returns `null` rather than showing an empty grid.
 */
export async function HomeCategoryCtas() {
  let tiles: PublicHomeTile[] = [];
  try {
    const res = await publicApiFetch<{ tiles: PublicHomeTile[] }>("/content/home-tiles", {
      tags: ["home-tiles"],
    });
    tiles = res.data.tiles;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    tiles = [];
  }

  if (tiles.length === 0) return null;

  return (
    <section className="bg-base py-3xl">
      <HomeCategoryCtaCarousel tiles={tiles} />
    </section>
  );
}
