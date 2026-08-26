import { getPublicNewProducts } from "@/lib/api/public-catalog";
import { ApiError } from "@/lib/api/error";
import { ProductCarousel } from "./ProductCarousel";

/**
 * The home's "Novedades" section (M12, entrega 5/10) — same shape as
 * `HomeCategories`/`HomeBrands`: fetch, swallow only `ApiError` (a genuine
 * bug must still surface), filter out anything the card can't render, and
 * render nothing rather than an empty rail with an orphaned heading.
 *
 * `bg-base`, not `bg-overlay` — restores the light/dark/light rhythm after
 * `HomeBrands`' dark marquee, same as the category rail did before it.
 */
export async function HomeNewProducts() {
  let products: Awaited<ReturnType<typeof getPublicNewProducts>> = [];
  try {
    products = await getPublicNewProducts();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    products = [];
  }

  const productsWithImage = products.filter((product) => product.gallery.length > 0);
  if (productsWithImage.length === 0) return null;

  return (
    <section className="bg-base py-3xl">
      <h2 className="mb-xl px-lg font-display text-h2 font-extrabold uppercase text-negro sm:text-h1">
        Novedades
      </h2>

      <ProductCarousel
        products={productsWithImage}
        ariaLabel="Novedades"
        previousLabel="Novedades anteriores"
        nextLabel="Siguientes novedades"
      />
    </section>
  );
}
