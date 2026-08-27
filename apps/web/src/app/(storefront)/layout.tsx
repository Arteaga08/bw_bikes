import type { PublicBrand, PublicCategoryTreeNode } from "@bw-bikes/shared";
import type { ReactNode } from "react";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/footer/Footer";
import { SkipLink } from "@/components/shell/SkipLink";
import { ApiError } from "@/lib/api/error";
import { getPublicAccessoryCategoryTree, getPublicBikeCategoryTree, getPublicBrands } from "@/lib/api/public-catalog";

/**
 * Public storefront shell (M12–M14). Wrapped by the real root layout
 * (`app/layout.tsx` already defines `<html>`/`<body>`), so this one is a
 * plain nested layout, not a second root layout — `(storefront)` exists only
 * to keep this tree's routes out of the URL and out of `app/admin`'s.
 *
 * Unlike `admin/(panel)/layout.tsx`, there's no session guard here: the
 * storefront is public by definition.
 *
 * Fetches the three nav mega-menu datasets once, here, in parallel, and
 * threads them down through `Navbar` to both `MobileMenu` and
 * `StorefrontNavLinks` — every route under this layout shares one fetch
 * instead of either surface re-fetching per page. Each call is wrapped in
 * its own `safe()` rather than one shared try/catch around `Promise.all`: a
 * failure in accessories or brands shouldn't empty out bike categories too.
 * Same fallback shape as before: an unreachable catalog degrades to an empty
 * list, which `MobileMenu`/`StorefrontNavLinks` already treat as "no data
 * yet" (a plain link, no accordion/panel), never a broken layout.
 * `getPublicBrands` is also called by `HomeBrands` — Next.js dedupes
 * identical `fetch` calls within one render, so this doesn't double the
 * round-trip.
 *
 * `Footer` sits here, not in `page.tsx` (M12 entrega 10/10): it is global
 * chrome — `DESIGN_SYSTEM.md` §5.1 calls it a footer that "vive en casi
 * todas las páginas del sitio" — the same tier as `Navbar`, not a
 * home-page-only section.
 */
async function safe<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    return await promise;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return [];
  }
}

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const [bikeCategories, accessoryCategories, brands] = await Promise.all([
    safe<PublicCategoryTreeNode>(getPublicBikeCategoryTree()),
    safe<PublicCategoryTreeNode>(getPublicAccessoryCategoryTree()),
    safe<PublicBrand>(getPublicBrands()),
  ]);

  return (
    <>
      <SkipLink targetId="contenido" />
      <Navbar bikeCategories={bikeCategories} accessoryCategories={accessoryCategories} brands={brands} />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <Footer />
    </>
  );
}
