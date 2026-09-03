import { ButtonLink } from "@/components/ui/ButtonLink";
import type { ComparableBike } from "@/lib/api/public-catalog";
import { formatCurrencyCents } from "@/lib/format";
import { productHref } from "@/components/storefront/products/product-href";

export interface ComparisonHeaderProps {
  bikes: ComparableBike[];
  /** Shares `ComparisonTable`'s column template so the header and every row below line up as the table scrolls horizontally. */
  gridTemplateColumns: string;
}

/**
 * The comparison's first row: brand, name, price, and the way through to
 * each bike's PDP — deliberately without the photo, which lives in its own
 * `ComparisonImageRow` further down. Rendered by `ComparisonTable` as the
 * first row of the *same* grid the spec rows use — not a separate element
 * positioned on top — so a `lg:sticky` on this row pins it under the navbar
 * without drifting out of column alignment as the table scrolls. Keeping it
 * to text and a button (no image) is what lets the pinned strip stay thin
 * instead of eating the viewport while the shopper scrolls the photo away.
 */
export function ComparisonHeader({
  bikes,
  gridTemplateColumns,
}: ComparisonHeaderProps) {
  return (
    <div
      className="grid gap-lg border-b border-borde bg-blanco px-lg py-lg lg:sticky lg:top-16 lg:z-20"
      style={{ gridTemplateColumns }}
    >
      {/* Empty — lines up with the label column every row below carries. */}
      <div aria-hidden="true" />
      {bikes.map((bike) => (
        <div key={bike.slug}>
          <p className="font-body text-caption uppercase text-grafito">
            {bike.brandName}
          </p>
          <p className="mt-xs font-display text-h3 text-negro">{bike.name}</p>
          <p className="mt-xs font-body text-body-l text-negro">
            {formatCurrencyCents(bike.price)}
          </p>
          <ButtonLink
            href={productHref({ kind: "bike", slug: bike.slug })}
            variant="ghost"
            className="mt-sm w-full"
          >
            Ver Detalles
          </ButtonLink>
        </div>
      ))}
    </div>
  );
}
