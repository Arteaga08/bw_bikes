import Image from "next/image";
import Link from "next/link";
import { formatCurrencyCents } from "@/lib/format";
import type { PublicProductSummary } from "@/lib/api/public-catalog";
import { productHref } from "./product-href";

export interface ProductCardProps {
  product: PublicProductSummary;
}

/**
 * One tile in the "Novedades" rail. Deliberately the same grammar as
 * `CategoryCard`: photo, then copy below it in flow, same `aspect-[4/5]`
 * frame, same center-growing dorado underline on the name — Manuel's call
 * was "el mismo diseño que la de categorías", not a new visual language for
 * a product tile.
 *
 * Two lines this card adds that `CategoryCard` doesn't: it's a product, not
 * a category, so a shopper needs the brand and the price before deciding to
 * click through. Server-safe: it only ever renders inside `ScrollRail`'s
 * client boundary, never opens one of its own.
 *
 * `HomeNewProducts` already filters out any product with an empty `gallery`,
 * so this component can assume `product.gallery[0]` exists rather than
 * branching on it here.
 */
export function ProductCard({ product }: ProductCardProps) {
  const image = product.gallery[0];
  if (!image) return null;

  return (
    <Link
      href={productHref(product)}
      className="group/card shrink-0 basis-[78%] snap-start sm:basis-[46%] lg:basis-[31%] xl:basis-[22%]"
    >
      {/* `bg-inset`, not `bg-surface` — same reserved decode placeholder as
          `CategoryCard` (`DESIGN.md` §4). */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-inset">
        <Image
          src={image.url}
          alt={image.alt ?? product.name}
          fill
          sizes="(max-width: 640px) 78vw, (max-width: 1024px) 46vw, 23vw"
          loading="lazy"
          className="object-cover transition-transform duration-500 ease-out-strong motion-safe:group-hover/card:scale-[1.03]"
        />
      </div>

      <p className="mt-md font-body text-caption uppercase text-grafito">{product.brand.name}</p>

      {/* Same underline-grows-from-center gesture as `CategoryCard`'s name —
          reused by hand, same reasoning: dorado lives only in the underline,
          the name stays `negro` on hover. */}
      <p className="relative mt-xs inline-block font-display text-h3 text-negro">
        {product.name}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-1 h-px origin-center scale-x-0 bg-dorado transition-transform duration-150 group-hover/card:scale-x-100"
        />
      </p>

      <p className="mt-xs font-body text-body-l text-negro">{formatCurrencyCents(product.price)}</p>
    </Link>
  );
}
