import type { PublicAccessory } from "@bw-bikes/shared";
import Image from "next/image";
import Link from "next/link";
import { ColorSwatch } from "@/components/ui/ColorSwatch";
import { formatCurrencyCents } from "@/lib/format";
import { toSummary, type PublicColorSwatch } from "@/lib/api/public-catalog";
import { productHref } from "./product-href";
import { stripBrandFromName } from "./product-name";

export interface RelatedAccessoriesProps {
  accessories: PublicAccessory[];
  /** Same map `ProductInfo` already builds for its own color selector — an accessory's color may not appear among *this* product's own variants, hence a separate lookup rather than reusing `selectedColor`'s options. */
  colorSwatchIndex: Map<string, PublicColorSwatch>;
}

const HEADING = "Completa tu equipo";
/** A row this narrow (24rem sticky column) still reads as dots past four; a fifth would touch the price on the line below. */
const MAX_COLOR_SWATCHES = 4;

function normalizeColorKey(value: string): string {
  return value.trim().toLocaleLowerCase("es");
}

/**
 * Cross-sell block in the PDP's sticky buy-box, right under
 * `PaymentMethodsBlock` — the storefront-facing counterpart to the admin's
 * hand-curated `relatedAccessories` (`RelatedAccessoriesPicker`, panel
 * admin). Compact rows, not `ProductCarousel`'s full-width rail: the
 * reference Manuel brought (Specialized/Cannondale "Complete Your Ride")
 * runs this inside the buy box itself, and a horizontal `ScrollRail` doesn't
 * fit a 24rem sticky column.
 *
 * No border per row, only hairlines between them (`divide-y`) — same
 * "jerarquía por espacio, nunca por adorno" the rest of the buy box follows
 * (`ProductSummaryCard`'s own doc comment). Each row links straight to the
 * accessory's own PDP rather than pretending to add it to a cart: `Comprar`
 * above is itself still `disabled` (checkout isn't built yet), so a
 * functioning "Agregar" button here would be a lie the rest of the page
 * doesn't tell either.
 *
 * Accessories with no gallery image yet are dropped — same guard
 * `HomeNewProducts`/`ProductCard` apply elsewhere.
 */
export function RelatedAccessories({ accessories, colorSwatchIndex }: RelatedAccessoriesProps) {
  const items = accessories
    .filter((accessory) => accessory.gallery.length > 0)
    .map((accessory) => toSummary(accessory, "accessory"));

  if (items.length === 0) return null;

  return (
    <div className="mt-lg border-t border-borde pt-lg">
      <h2 className="font-display text-h3 text-negro">{HEADING}</h2>

      <ul className="mt-md flex flex-col divide-y divide-borde">
        {items.map((item) => {
          const image = item.gallery[0];
          if (!image) return null;

          const shownColors = item.colors.slice(0, MAX_COLOR_SWATCHES);
          const extraColors = item.colors.length - shownColors.length;

          return (
            <li key={item.id}>
              <Link
                href={productHref(item)}
                className="group/related -mx-sm flex items-center gap-sm rounded-control px-sm py-sm transition-colors duration-150 hover:bg-base"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control bg-blanco">
                  <Image src={image.url} alt={image.alt ?? item.name} fill sizes="64px" className="object-contain" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-caption uppercase text-grafito">{item.brand.name}</p>
                  <p className="truncate font-body text-body text-negro group-hover/related:underline">
                    {stripBrandFromName(item.name, item.brand.name)}
                  </p>

                  {shownColors.length > 0 ? (
                    <div className="mt-xs flex items-center gap-xs">
                      <span className="sr-only">Colores: {item.colors.join(", ")}</span>
                      {shownColors.map((color) => {
                        const swatch = colorSwatchIndex.get(normalizeColorKey(color));
                        return (
                          <ColorSwatch
                            key={color}
                            hex={swatch?.hex ?? null}
                            secondaryHex={swatch?.secondaryHex}
                            className="h-3 w-3"
                          />
                        );
                      })}
                      {extraColors > 0 ? (
                        <span className="font-body text-caption text-grafito">+{extraColors}</span>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="mt-xs font-body text-body text-negro">{formatCurrencyCents(item.price)}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
