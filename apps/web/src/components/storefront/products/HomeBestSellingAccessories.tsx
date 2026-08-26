import { getPublicBestSellingAccessories } from "@/lib/api/public-catalog";
import { ApiError } from "@/lib/api/error";
import { ProductCarousel } from "./ProductCarousel";

/**
 * The home's "Accesorios más vendidos" section — same rail shape as
 * `HomeNewProducts`/`HomeFavoriteProducts`, but scoped to accessories only
 * (bikes flagged `isNewArrival` stay in "Novedades"). Identical data seam:
 * fetch, swallow only `ApiError` (a genuine bug must still surface), filter
 * out anything the card can't render, and render nothing rather than an
 * empty rail with an orphaned heading.
 */
export async function HomeBestSellingAccessories() {
  let products: Awaited<ReturnType<typeof getPublicBestSellingAccessories>> = [];
  try {
    products = await getPublicBestSellingAccessories();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    products = [];
  }

  const productsWithImage = products.filter((product) => product.gallery.length > 0);
  if (productsWithImage.length === 0) return null;

  return (
    <section className="bg-base py-3xl">
      <h2 className="mb-xl px-lg font-display text-h2 font-extrabold uppercase text-negro sm:text-h1">
        Accesorios más vendidos
      </h2>

      <ProductCarousel
        products={productsWithImage}
        ariaLabel="Accesorios más vendidos"
        previousLabel="Accesorios anteriores"
        nextLabel="Siguientes accesorios"
      />
    </section>
  );
}
