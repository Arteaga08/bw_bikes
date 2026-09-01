import { CaretRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Fragment } from "react";

export interface ProductBreadcrumb {
  label: string;
  /** Omitted on the last crumb — the product itself, current page, not a link. */
  href?: string;
}

/**
 * "Categoría / Subcategoría / Producto" trail above the PDP gallery, e.g.
 * Cannondale's "ELECTRIC / E-MOUNTAIN / MOTERRA SL" reference. Server
 * component — the crumb chain is resolved once in the page (`findCategoryAncestry`
 * against the already-fetched category tree) and passed down, so this stays a
 * pure render with no client-side category lookup.
 */
export function ProductBreadcrumbs({ crumbs }: { crumbs: ProductBreadcrumb[] }) {
  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Migas de pan"
      className="mb-lg flex items-center gap-sm overflow-x-auto whitespace-nowrap"
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <Fragment key={`${crumb.label}-${index}`}>
            {index > 0 ? <CaretRight aria-hidden="true" size={14} className="shrink-0 text-grafito" /> : null}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="font-ui text-body-l tracking-wide text-grafito uppercase underline decoration-grafito underline-offset-4 hover:text-negro hover:decoration-dorado"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="font-ui text-body-l tracking-wide text-negro uppercase underline underline-offset-4">
                {crumb.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
