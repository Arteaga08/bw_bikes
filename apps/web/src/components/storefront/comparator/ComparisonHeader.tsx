import { ButtonLink } from "@/components/ui/ButtonLink";
import type { ComparableBike } from "@/lib/api/public-catalog";
import { formatCurrencyCents } from "@/lib/format";
import { productHref } from "@/components/storefront/products/product-href";

export interface ComparisonHeaderProps {
  bikes: ComparableBike[];
}

/**
 * The comparison's first row: brand, name, price, and the way through to
 * each bike's PDP — deliberately without the photo, which lives in its own
 * `ComparisonImageRow` further down. Rendered by `ComparisonTable` as the
 * first row of the *same* grid the spec rows use — not a separate element
 * positioned on top — so `ComparisonScroller` can pin it under the navbar
 * without it drifting out of column alignment as the table scrolls. Keeping it
 * to text and a button (no image) is what lets the pinned strip stay thin
 * instead of eating the viewport while the shopper scrolls the photo away.
 */
export function ComparisonHeader({ bikes }: ComparisonHeaderProps) {
  return (
    <div className="grid gap-md border-b border-borde bg-blanco px-md py-lg [grid-template-columns:var(--comparison-columns-mobile)] lg:gap-lg lg:px-lg lg:[grid-template-columns:var(--comparison-columns)]">
      {/* Empty — lines up with the label column every row below carries, which only exists from `lg` up. */}
      <div aria-hidden="true" className="hidden lg:block" />
      {bikes.map((bike) => (
        <div key={bike.slug} className="flex h-full flex-col">
          {/* One line, always: a long brand wrapping would shift this column's name, price and CTA out of line with its neighbors'. */}
          <p className="truncate font-body text-caption uppercase text-grafito">
            {bike.brandName}
          </p>
          {/* Two lines, always — `min-h` reserves them for short names, `line-clamp-2` caps long ones, so every column's price and CTA sit at the same height. The em-based height follows each breakpoint's own line-height (1.6 for `text-body-l`, 1.3 for `text-h3`), and the full name is one tap away on the PDP. */}
          <p className="mt-xs line-clamp-2 min-h-[3.2em] font-display text-body-l text-negro lg:min-h-[2.6em] lg:text-h3">
            {bike.name}
          </p>
          <p className="mt-xs font-body text-body-l text-negro">
            {formatCurrencyCents(bike.price)}
          </p>
          {/* Absorbs whatever height difference the columns still have, so every CTA sits on the same baseline — without `mt-auto`, which would swallow the gap below the price when the columns happen to match. */}
          <div aria-hidden="true" className="flex-1" />
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
