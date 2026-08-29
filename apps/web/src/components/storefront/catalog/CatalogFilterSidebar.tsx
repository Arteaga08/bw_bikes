import type { PublicCatalogFilterOptions, PublicCategoryTreeNode } from "@bw-bikes/shared";
import { CatalogFilterGroups } from "./CatalogFilterGroups";

export interface CatalogFilterSidebarProps {
  categoryTree: PublicCategoryTreeNode[];
  options: PublicCatalogFilterOptions;
  hideCategoryFilter?: boolean;
  fixedCategoryId?: string;
}

/**
 * Desktop filter column (`lg` and up — `CatalogFilterDrawer` covers
 * everything below that). `sticky` under the navbar with its own
 * `overflow-y-auto`: a long "Ver más"-expanded color grid scrolls inside the
 * column instead of pushing the page's own scrollbar or the product grid
 * out of view.
 *
 * Active-filter chips live in `CatalogActiveFilters`, in the results column
 * instead of here — this column is `hidden` below `lg`, and a mobile
 * shopper filtering via `CatalogFilterDrawer` still needs chip feedback.
 */
export function CatalogFilterSidebar({
  categoryTree,
  options,
  hideCategoryFilter,
  fixedCategoryId,
}: CatalogFilterSidebarProps) {
  return (
    <aside className="hidden lg:block">
      {/* `top-16`/`h-16` matches the navbar's own fixed height (`Navbar.tsx`) —
          without it, `sticky top-0` would let the sidebar's own top scroll
          in under the fixed navbar instead of stopping just beneath it. */}
      <div className="sticky top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain py-xl pr-lg">
        <CatalogFilterGroups
          categoryTree={categoryTree}
          options={options}
          hideCategoryFilter={hideCategoryFilter}
          fixedCategoryId={fixedCategoryId}
        />
      </div>
    </aside>
  );
}
