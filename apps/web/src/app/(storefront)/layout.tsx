import type { PublicCategoryTreeNode } from "@bw-bikes/shared";
import type { ReactNode } from "react";
import { Navbar } from "@/components/storefront/Navbar";
import { SkipLink } from "@/components/shell/SkipLink";
import { ApiError } from "@/lib/api/error";
import { getPublicBikeCategoryTree } from "@/lib/api/public-catalog";

/**
 * Public storefront shell (M12–M14). Wrapped by the real root layout
 * (`app/layout.tsx` already defines `<html>`/`<body>`), so this one is a
 * plain nested layout, not a second root layout — `(storefront)` exists only
 * to keep this tree's routes out of the URL and out of `app/admin`'s.
 *
 * Unlike `admin/(panel)/layout.tsx`, there's no session guard here: the
 * storefront is public by definition.
 *
 * Fetches the bike category tree once, here, and threads it down through
 * `Navbar` to `MobileMenu` — every route under this layout shares one fetch
 * instead of the drawer re-fetching per page. Same fallback shape as
 * `HomeHero`: an unreachable catalog degrades to an empty list, which
 * `MobileMenu` already treats as "no categories yet" (a plain link, no
 * accordion), never a broken layout.
 */
export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  let bikeCategories: PublicCategoryTreeNode[] = [];
  try {
    bikeCategories = await getPublicBikeCategoryTree();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    bikeCategories = [];
  }

  return (
    <>
      <SkipLink targetId="contenido" />
      <Navbar bikeCategories={bikeCategories} />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
    </>
  );
}
