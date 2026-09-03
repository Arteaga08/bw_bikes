import Image from "next/image";
import Link from "next/link";
import { CURRENCY } from "@bw-bikes/shared";
import { Badge } from "@/components/ui/Badge";
import { ColorSwatch } from "@/components/ui/ColorSwatch";
import type { PublicColorSwatch, PublicProductSummary } from "@/lib/api/public-catalog";
import { formatCurrencyCents } from "@/lib/format";
import { productHref } from "@/components/storefront/products/product-href";
import { SaveButton } from "@/components/storefront/products/SaveButton";
import { CompareCheckbox } from "@/components/storefront/comparison/CompareCheckbox";

export interface CatalogProductCardProps {
  product: PublicProductSummary;
  /** Product `color` names → their template's hex, built once per page by `buildColorSwatchIndex` — not re-looked-up per card. */
  colorSwatchIndex: Map<string, PublicColorSwatch>;
}

/** How many curated badges (`product.badges`) stack under the discount badge before crowding the corner. The discount badge, when present, always gets a slot on top of this cap. */
const MAX_CURATED_BADGES = 2;

/** How many color circles show before folding the rest into a "+N". Five is what a `bg-inset` frame this size still reads as dots, not a strip. */
const MAX_COLOR_SWATCHES = 5;

/** Secondary text on the card's `bg-overlay` body — the inverse token `DESIGN.md` already defines for `button-inverse`. `grafito` doesn't pass AA on black. */
const SECONDARY_ON_DARK = "text-[rgba(250,250,250,0.7)]";

function normalizeColorKey(value: string): string {
  return value.trim().toLocaleLowerCase("es");
}

/**
 * `product.name` arrives with the brand baked in ("Trek Verve+ 2"), but this
 * card already shows the brand above, in the eyebrow — repeating it in the
 * name is noise. Only strips when the name starts with the brand followed
 * by whitespace (or ends exactly there), so a brand like "Trek" doesn't
 * maul a model that only starts similarly ("Trekking X").
 */
function stripBrandFromName(name: string, brandName: string): string {
  const brand = brandName.trim();
  if (!brand || !name.toLocaleLowerCase("es").startsWith(brand.toLocaleLowerCase("es"))) return name;

  const nextChar = name.charAt(brand.length);
  if (nextChar !== "" && !/\s/.test(nextChar)) return name;

  const rest = name.slice(brand.length).trimStart();
  return rest.length > 0 ? rest : name;
}

function RhinoMark() {
  return <Image src="/brand/rhino-dorado.svg" alt="" aria-hidden="true" width={16} height={7} className="shrink-0" />;
}

/**
 * One catalog tile, "placa negra": photo frame in `bg-surface` (the product
 * still needs that neutral ground) over a `bg-overlay` body in white text —
 * a row of three reads as three black plates, literally the store's name.
 * The winner of five mockups compared side by side (`impeccable` +
 * `design-taste-frontend`, 2026-08-28) — see that session for the four
 * runners-up.
 *
 * Deliberately breaks `DESIGN_SYSTEM.md` §5.1's old "la grilla de tarjetas
 * de producto en sí sigue sin rinoceronte" — Manuel's call after comparing
 * it against four variants that kept that rule. §5/§5.1 were updated the
 * same day to document the exception rather than leave the written rule
 * contradicting the code.
 *
 * The hover swap is the hero's own gesture (`HeroCarousel`'s `translateX`
 * over a flex row): a two-photo product gets a second angle on hover
 * instead of just a bigger one; a single-photo product falls back to a
 * zoom. Server-safe: no hover state, no click handler beyond the outer
 * `<Link>`.
 */
export function CatalogProductCard({ product, colorSwatchIndex }: CatalogProductCardProps) {
  const [image, secondImage] = product.gallery;
  if (!image) return null;

  const discountPercent =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null;

  const curatedBadges = product.badges.slice(0, MAX_CURATED_BADGES);
  const shownColors = product.colors.slice(0, MAX_COLOR_SWATCHES);
  const extraColorCount = product.colors.length - shownColors.length;

  return (
    <Link href={productHref(product)} className="group/card block overflow-hidden rounded-card bg-overlay">
      {/* `bg-blanco`, matching `ProductCard`/`ComparisonHeader`'s photo frame
          and the studio backdrop baked into every gallery asset at upload
          (`whitenStudioBackground`, apps/api) — not `bg-surface`'s pure
          white, which is reserved for cards/inputs/modals. `contain`
          letterboxes the photo, so the frame color is what a shopper
          actually sees around it; matching the baked backdrop is what makes
          the frame disappear instead of drawing a visible rectangle around
          the photo. */}
      <div className="relative aspect-[4/3] overflow-hidden bg-blanco">
        {secondImage ? (
          // Same mechanism as `HeroCarousel.tsx`'s slide track, reduced to
          // the two-photo case: both images sit side by side in one flex
          // row, and the hover state translates the whole row by exactly one
          // frame width. `motion-safe:` gates the triggering utility only —
          // `transition-transform` stays on unconditionally, so under
          // `prefers-reduced-motion` the transform simply never changes
          // instead of jumping.
          <div className="flex h-full w-full transition-transform duration-500 ease-out-strong motion-safe:group-hover/card:-translate-x-full">
            <div className="relative h-full w-full shrink-0">
              <Image
                src={image.url}
                alt={image.alt ?? product.name}
                fill
                sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 31vw"
                className="object-contain"
              />
            </div>
            <div className="relative h-full w-full shrink-0">
              <Image
                src={secondImage.url}
                alt=""
                fill
                sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 31vw"
                loading="lazy"
                className="object-contain"
              />
            </div>
          </div>
        ) : (
          <Image
            src={image.url}
            alt={image.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 31vw"
            className="object-contain transition-transform duration-500 ease-out-strong motion-safe:group-hover/card:scale-[1.03]"
          />
        )}

        {discountPercent || curatedBadges.length > 0 ? (
          <div className="absolute left-md top-md z-10 flex flex-col items-start gap-xs">
            {discountPercent ? <Badge variant="accent">-{discountPercent}%</Badge> : null}
            {curatedBadges.map((badge) => (
              <Badge key={badge.id} variant={badge.variant}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="absolute right-md top-md z-10">
          <SaveButton itemType={product.kind} itemId={product.id} tone="inverse" className="bg-negro/40 backdrop-blur-sm" />
        </div>
      </div>

      <div className="p-md">
        {shownColors.length > 0 ? (
          <div className="mb-sm flex items-center gap-xs">
            <span className="sr-only">Colores: {product.colors.join(", ")}</span>
            {shownColors.map((color) => {
              const swatch = colorSwatchIndex.get(normalizeColorKey(color));
              return (
                <ColorSwatch
                  key={color}
                  hex={swatch?.hex ?? null}
                  secondaryHex={swatch?.secondaryHex}
                  className="h-4 w-4"
                />
              );
            })}
            {extraColorCount > 0 ? (
              <span className={`font-body text-caption ${SECONDARY_ON_DARK}`}>+{extraColorCount}</span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-xs">
          <RhinoMark />
          <p className={`font-body text-eyebrow uppercase ${SECONDARY_ON_DARK}`}>{product.brand.name}</p>
        </div>

        {/* Same underline-grows-from-center gesture as `ProductCard`/`CategoryCard`'s name. */}
        <p className="relative mt-xs inline-block font-display text-h3 text-blanco">
          {stripBrandFromName(product.name, product.brand.name)}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-px origin-center scale-x-0 bg-dorado transition-transform duration-150 group-hover/card:scale-x-100"
          />
        </p>

        <div className="mt-xs flex flex-wrap items-baseline gap-x-sm gap-y-0">
          <p className="font-body text-body-l text-blanco">{formatCurrencyCents(product.price)}</p>
          <span className={`font-body text-caption ${SECONDARY_ON_DARK}`}>{CURRENCY}</span>
          {product.compareAtPrice ? (
            <p className={`font-body text-body ${SECONDARY_ON_DARK}`}>
              <span className="sr-only">Precio anterior: </span>
              <s>
                {formatCurrencyCents(product.compareAtPrice)} {CURRENCY}
              </s>
            </p>
          ) : null}
        </div>

        {/* Bike-only — comparison isn't offered for accessories, and this
            row must not reserve space (`mt-sm`) on a card that won't render
            anything inside it. */}
        {product.kind === "bike" ? (
          <div className="mt-sm flex justify-end">
            <CompareCheckbox product={product} />
          </div>
        ) : null}
      </div>
    </Link>
  );
}
