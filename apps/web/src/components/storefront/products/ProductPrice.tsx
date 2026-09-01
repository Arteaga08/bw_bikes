import { CURRENCY, type PriceCents, type ProductVariant } from "@bw-bikes/shared";
import { formatCurrencyCents } from "@/lib/format";

export interface ProductPriceProps {
  basePrice: PriceCents;
  compareAtPrice?: PriceCents;
  /** The variant matching the shopper's current color/talla pick, if any. */
  selectedVariant?: ProductVariant;
}

/**
 * Shows the selected variant's own price when it overrides the product's
 * base price (`ProductVariant.price` — a limited-edition color, an XL
 * frame) and falls back to `basePrice` once no variant is selected yet or
 * the matched one carries no override. `compareAtPrice` stays product-level
 * always: no variant carries its own "precio anterior".
 *
 * `text-h3`, un escalón por debajo del `<h1>` de `ProductInfo` (`text-h2`):
 * el título de la página es el nombre del producto, no su precio. Antes
 * ambos estaban invertidos y el precio le ganaba al nombre.
 */
export function ProductPrice({ basePrice, compareAtPrice, selectedVariant }: ProductPriceProps) {
  const displayPrice = selectedVariant?.price ?? basePrice;

  return (
    <div className="flex flex-wrap items-baseline gap-x-sm gap-y-0">
      <p className="font-display text-h3 font-extrabold text-negro">{formatCurrencyCents(displayPrice)}</p>
      <span className="font-body text-caption text-grafito">{CURRENCY}</span>
      {compareAtPrice && compareAtPrice > displayPrice ? (
        <p className="font-body text-body text-grafito">
          <span className="sr-only">Precio anterior: </span>
          <s>
            {formatCurrencyCents(compareAtPrice)} {CURRENCY}
          </s>
        </p>
      ) : null}
    </div>
  );
}
