import type { AdminAccessory, AdminBike, AdminCategory, AdminHeroSlide } from "@bw-bikes/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import { HeroSlidesView } from "./HeroSlidesView";

/**
 * The four catalog lists a CTA's target picker searches — fetched once,
 * server-side, alongside the slides themselves. `limit=100` is the query
 * layer's hard cap (`utils/list-query.ts`), which the real catalog won't
 * exceed for a while; when it does, this picker needs its own search
 * endpoint rather than a bigger limit.
 */
export default async function HeroInicioPage() {
  const [slidesRes, bikesRes, accessoriesRes, bikeCategoriesRes, accessoryCategoriesRes] = await Promise.all([
    serverApiFetch<{ slides: AdminHeroSlide[] }>("/admin/content/hero-slides"),
    serverApiFetch<{ bikes: AdminBike[] }>("/admin/bikes?limit=100"),
    serverApiFetch<{ accessories: AdminAccessory[] }>("/admin/accessories?limit=100"),
    serverApiFetch<{ categories: AdminCategory[] }>("/admin/bike-categories?limit=100"),
    serverApiFetch<{ categories: AdminCategory[] }>("/admin/accessory-categories?limit=100"),
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
    </>
  );
}
