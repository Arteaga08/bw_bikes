import type { AdminAccessory, AdminBike, AdminBikeOfMonth, AdminCategory, AdminHeroSlide, AdminHomeTile } from "@bw-bikes/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import { BikeOfMonthView } from "./BikeOfMonthView";
import { HeroSlidesView } from "./HeroSlidesView";
import { HomeTilesView } from "./HomeTilesView";

/**
 * The four catalog lists a CTA's target picker searches — fetched once,
 * server-side, alongside the slides themselves. `limit=100` is the query
 * layer's hard cap (`utils/list-query.ts`), which the real catalog won't
 * exceed for a while; when it does, this picker needs its own search
 * endpoint rather than a bigger limit.
 */
export default async function HeroInicioPage() {
  const [slidesRes, bikesRes, accessoriesRes, bikeCategoriesRes, accessoryCategoriesRes, homeTilesRes, bikeOfMonthRes] =
    await Promise.all([
      serverApiFetch<{ slides: AdminHeroSlide[] }>("/admin/content/hero-slides"),
      serverApiFetch<{ bikes: AdminBike[] }>("/admin/bikes?limit=100"),
      serverApiFetch<{ accessories: AdminAccessory[] }>("/admin/accessories?limit=100"),
      serverApiFetch<{ categories: AdminCategory[] }>("/admin/bike-categories?limit=100"),
      serverApiFetch<{ categories: AdminCategory[] }>("/admin/accessory-categories?limit=100"),
      serverApiFetch<{ tiles: AdminHomeTile[] }>("/admin/content/home-tiles"),
      serverApiFetch<{ bikeOfMonth: AdminBikeOfMonth }>("/admin/content/bike-of-month"),
    ]);

  return (
    <>
      <PageHeader
        title="Hero de inicio"
        subtitle="Las fotos, textos y botones del carrusel que abre la página de inicio — hasta 5 slides."
      />
      <HeroSlidesView
        initialSlides={slidesRes.data.slides}
        bikes={bikesRes.data.bikes}
        accessories={accessoriesRes.data.accessories}
        bikeCategories={bikeCategoriesRes.data.categories}
        accessoryCategories={accessoryCategoriesRes.data.categories}
      />
      <HomeTilesView initialTiles={homeTilesRes.data.tiles} />
      <BikeOfMonthView initialBikeOfMonth={bikeOfMonthRes.data.bikeOfMonth} bikes={bikesRes.data.bikes} />
    </>
  );
}
