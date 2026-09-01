import type { PublicAccessory } from "@bw-bikes/shared";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
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
const CTA_LABEL = "Añadir al carrito";
/** El renglón del precio deja ~200px libres a la derecha; cuatro puntos de 20px con su `+N` los llenan, un quinto empujaría contra el precio. */
const MAX_COLOR_SWATCHES = 4;

function normalizeColorKey(value: string): string {
  return value.trim().toLocaleLowerCase("es");
}

/**
 * Cross-sell block in the PDP's sticky buy-box, right under
 * `PaymentMethodsBlock` — the storefront-facing counterpart to the admin's
 * hand-curated `relatedAccessories` (`RelatedAccessoriesPicker`, panel
 * admin). Compact items, not `ProductCarousel`'s full-width rail: the
 * reference Manuel brought (Specialized/Cannondale "Complete Your Ride")
 * runs this inside the buy box itself, and a horizontal `ScrollRail` doesn't
 * fit a 24rem sticky column.
 *
 * Cada ítem son **dos hermanos, no un solo enlace envolvente**: el `<a>` que
 * cubre foto y texto, y el `<button>` del CTA debajo. No es preferencia de
 * layout — un `<button>` dentro de un `<a>` es HTML inválido y lo prohíbe
 * `DESIGN_SYSTEM.md` §6 por escrito. Es además la misma anatomía de la
 * referencia: la ficha lleva al producto, el botón hace otra cosa.
 *
 * Lo que se toma de la referencia y cómo se traduce al sistema:
 *
 * - **La foto pesa.** 96px. El recuadro se queda del color de la página
 *   (`bg-blanco`) y no de una superficie propia por la misma razón que
 *   documenta `ProductCard`: la foto de estudio viene sobre blanco, así que
 *   un `inset` gris detrás dibujaría un rectángulo blanco visible dentro del
 *   recuadro. El peso lo da el tamaño, no una caja.
 * - **El precio ancla el ítem.** Nombre y precio eran los dos `text-body`
 *   regular, dos líneas idénticas sin foco. Ahora el nombre va en `body-l` y
 *   el precio es el único `font-medium` del bloque — dos pesos en total, como
 *   pide la Two-Weight Rule. Comparte línea con los swatches (precio a la
 *   izquierda, colores a la derecha): son los dos datos de la decisión, y en
 *   una columna así de angosta una línea menos es más aire por ítem.
 * - **Los swatches se leen.** 20px, el tamaño de la referencia. A los 12px
 *   originales eran motas, no colores.
 * - **CTA propio por ítem, `ghost` y no `primary`.** El dorado ya lo gasta
 *   `Comprar` arriba y The One Accent Rule admite un solo CTA primario por
 *   vista; la referencia hace lo mismo (su botón por ítem es delineado, no el
 *   sólido de la ficha principal). Va `disabled` con el mismo
 *   `title="Disponible próximamente"` que `Comprar`, porque el checkout aún
 *   no existe: el botón declara la intención sin prometer un carrito que no
 *   está construido. Cuando exista, esto deja de ser `disabled` y nada más.
 *
 * Sin filete entre ítems. El borde del CTA ya cierra cada ítem con una banda
 * horizontal fuerte; un hairline encima sería el adorno que
 * `ProductSummaryCard` descarta al lado ("jerarquía por espacio y contraste,
 * nunca por adorno", `handoff/DESIGN_SYSTEM.md` §1). La única regla
 * horizontal que queda es la estructural que abre el bloque.
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

      <ul className="mt-md flex flex-col gap-lg">
        {items.map((item) => {
          const image = item.gallery[0];
          if (!image) return null;

          const displayName = stripBrandFromName(item.name, item.brand.name);
          const shownColors = item.colors.slice(0, MAX_COLOR_SWATCHES);
          const extraColors = item.colors.length - shownColors.length;

          return (
            <li key={item.id}>
              <Link
                href={productHref(item)}
                className="group/related -mx-sm flex items-center gap-md rounded-card px-sm py-sm transition-colors duration-150 hover:bg-base"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-card bg-blanco">
                  <Image src={image.url} alt={image.alt ?? item.name} fill sizes="96px" className="object-contain" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-caption uppercase text-grafito">{item.brand.name}</p>
                  {/*
                    Subrayado dorado real (`text-decoration`), no el span
                    absoluto que crece desde el centro de `ProductCard`/
                    `CategoryCard`: ese span se dimensiona contra la caja del
                    bloque, y aquí el nombre envuelve a dos líneas
                    (`line-clamp-2`), así que la línea saldría del ancho del
                    contenedor en vez del ancho del texto. `text-decoration`
                    sigue a los glifos y se corta bien en cada renglón.
                  */}
                  <p className="mt-xs font-body text-body-l text-negro line-clamp-2 decoration-dorado decoration-1 underline-offset-4 group-hover/related:underline">
                    {displayName}
                  </p>

                  <div className="mt-sm flex items-center justify-between gap-sm">
                    <p className="font-body text-body-l font-medium text-negro">{formatCurrencyCents(item.price)}</p>

                    {shownColors.length > 0 ? (
                      <div className="flex shrink-0 items-center gap-xs">
                        <span className="sr-only">Colores: {item.colors.join(", ")}</span>
                        {shownColors.map((color) => {
                          const swatch = colorSwatchIndex.get(normalizeColorKey(color));
                          return (
                            <ColorSwatch
                              key={color}
                              hex={swatch?.hex ?? null}
                              secondaryHex={swatch?.secondaryHex}
                              className="h-5 w-5"
                            />
                          );
                        })}
                        {extraColors > 0 ? (
                          <span className="font-body text-caption text-grafito">+{extraColors}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>

              {/*
                `aria-label` con el nombre del producto: tres botones seguidos
                con la misma etiqueta "Añadir al carrito" son indistinguibles
                para un lector de pantalla que recorre la lista de controles.
                Queda listo para cuando el botón deje de estar `disabled`.
              */}
              <Button
                variant="ghost"
                size="sm"
                disabled
                title="Disponible próximamente"
                aria-label={`${CTA_LABEL}: ${displayName}`}
                className="mt-sm w-full"
              >
                {CTA_LABEL}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
