import { getPublicBikeCategoryTree } from "@/lib/api/public-catalog";
import { ApiError } from "@/lib/api/error";
import { CategoryCarousel } from "./CategoryCarousel";

/**
 * Server Component: the home's third section, "Explorar bicis" — the
 * category rail referenced from cannondale.com/es-mx's "Explore Bikes". Data
 * seam mirrors `HomeHero`: fetch, swallow `ApiError` into an empty list, and
 * let the caller degrade gracefully instead of breaking the page.
 *
 * Only **root** categories (`parent === null`) belong here — subcategories
 * are the navbar accordion's job (`Navbar` → `NavAccordionItem`), not the
 * home page's. `getPublicBikeCategoryTree()` already returns exactly the
 * roots, sorted `{ order, name }`, so no re-sorting happens here.
 *
 * A root category without an uploaded `image` is dropped rather than shown
 * with a placeholder — Manuel's call: the admin controls what appears in
 * this section by uploading the photo, nothing else gates it. If every
 * category lacks an image the section renders nothing at all; the home page
 * must never show an empty rail with a heading and no content under it.
 */
export async function HomeCategories() {
  let categories: Awaited<ReturnType<typeof getPublicBikeCategoryTree>> = [];
  try {
    categories = await getPublicBikeCategoryTree();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    categories = [];
  }

  const categoriesWithImage = categories.filter((category) => category.image);
  if (categoriesWithImage.length === 0) return null;

  return (
    <section className="bg-base py-3xl">
      <h2 className="mb-xl px-lg font-display text-h2 font-extrabold uppercase text-negro sm:px-[clamp(2rem,8vw,8rem)] sm:text-h1">
        Explorar Bicicletas
      </h2>

      <CategoryCarousel categories={categoriesWithImage} />
    </section>
  );
}
