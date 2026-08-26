import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { ComparableBike } from "@/lib/api/public-catalog";
import { formatCurrencyCents } from "@/lib/format";
import { productHref } from "../products/product-href";

export interface ComparatorColumnProps {
  bike: ComparableBike;
  /** Dimmed while its replacement is in flight, so the column never blanks out mid-swap. */
  isLoading?: boolean;
}

/**
 * One side of the comparison: photo, brand, name, price and the way through
 * to the PDP.
 *
 * Same frame grammar as `ProductCard` — `aspect-[4/5]` with `object-contain`
 * over `bg-base`, because a bike's studio shot is landscape and `cover`
 * crops it at the wheels, and because a white frame over the page's ash
 * background reads as a visible box. Not `ProductCard` itself: that one is a
 * `Link`-wrapped rail tile sized in `basis-*` percentages, and nesting its
 * anchor around a column that already owns a button would put a link inside
 * a link.
 */
export function ComparatorColumn({ bike, isLoading = false }: ComparatorColumnProps) {
  return (
    <div
      className={
        isLoading
          ? "opacity-60 transition-opacity duration-150"
          : "opacity-100 transition-opacity duration-150"
      }
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-base">
        {bike.image ? (
          <Image
            src={bike.image.url}
            alt={bike.image.alt ?? bike.name}
            fill
            sizes="(max-width: 640px) 46vw, 40vw"
            className="object-contain"
          />
        ) : null}
      </div>

      <p className="mt-md font-body text-caption uppercase text-grafito">{bike.brandName}</p>
      <p className="mt-xs font-display text-h3 text-negro">{bike.name}</p>
      <p className="mt-xs font-body text-body-l text-negro">{formatCurrencyCents(bike.price)}</p>

      <ButtonLink href={productHref({ kind: "bike", slug: bike.slug })} variant="ghost" className="mt-md w-full">
        Ver ficha
      </ButtonLink>
    </div>
  );
}
