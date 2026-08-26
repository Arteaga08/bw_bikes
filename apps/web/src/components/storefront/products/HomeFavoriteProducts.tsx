import { getPublicFavoriteProducts } from "@/lib/api/public-catalog";
import { ApiError } from "@/lib/api/error";
import { ProductCarousel } from "./ProductCarousel";

/**
 * The home's "Favoritas de los ciclistas" section (M12, entrega 8/10) — the
 * same rail as `HomeNewProducts`, reading the other curation flag
 * (`isCustomerFavorite`). Identical data seam: fetch, swallow only `ApiError`
 * (a genuine bug must still surface), filter out anything the card can't
 * render, and render nothing rather than an empty rail with an orphaned
 * heading.
 *
 * Deliberately not a variant prop on `HomeNewProducts`: the two sections
 * share the carousel, not their copy or their data source, and a `kind`
 * prop threading heading + fetcher through one component would be harder to
 * read than two files that each say what they show.
 */
export async function HomeFavoriteProducts() {
  let products: Awaited<ReturnType<typeof getPublicFavoriteProducts>> = [];
  try {
    products = await getPublicFavoriteProducts();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    products = [];
  }

  const productsWithImage = products.filter((product) => product.gallery.length > 0);
  if (productsWithImage.length === 0) return null;

  return (
    <section className="bg-base py-3xl">
      <h2 className="mb-xl px-lg font-display text-h2 font-extrabold uppercase text-negro sm:px-[clamp(2rem,8vw,8rem)] sm:text-h1">
        Favoritas de los ciclistas
      </h2>

      <ProductCarousel
        products={productsWithImage}
        ariaLabel="Favoritas de los ciclistas"
        previousLabel="Favoritas anteriores"
        nextLabel="Siguientes favoritas"
      />
    </section>
  );
}
