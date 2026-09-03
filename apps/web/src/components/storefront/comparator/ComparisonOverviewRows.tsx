import Image from "next/image";
import { ColorSwatch } from "@/components/ui/ColorSwatch";
import { normalizeColorKey, type ComparableBike, type PublicColorSwatch } from "@/lib/api/public-catalog";
import { ComparisonRowShell, MISSING } from "./ComparisonRow";

export interface ComparisonOverviewRowProps {
  bikes: ComparableBike[];
  gridTemplateColumns: string;
}

/**
 * The photo, now a row of its own instead of living inside `ComparisonHeader`
 * — the sticky header pins brand/name/price/CTA under the navbar, and the
 * photo scrolls away with the rest of "Ficha general" underneath it.
 */
export function ComparisonImageRow({ bikes, gridTemplateColumns }: ComparisonOverviewRowProps) {
  return (
    <ComparisonRowShell label="Imagen" gridTemplateColumns={gridTemplateColumns}>
      {bikes.map((bike) => (
        <dd key={bike.slug} className="relative aspect-[4/3] overflow-hidden rounded-card bg-blanco">
          <span className="sr-only">{bike.name}</span>
          {bike.image ? (
            <Image
              src={bike.image.url}
              alt={bike.image.alt ?? bike.name}
              fill
              sizes="(max-width: 1023px) 60vw, 20vw"
              className="object-contain"
            />
          ) : null}
        </dd>
      ))}
    </ComparisonRowShell>
  );
}

export interface ComparisonColorsRowProps extends ComparisonOverviewRowProps {
  colorSwatchIndex: Map<string, PublicColorSwatch>;
}

/**
 * Swatches only, no color names on screen (names go to `sr-only` instead) —
 * same call `ColorSwatchSelector`/`RelatedAccessories` already make for a
 * dense product listing. A name with no matching template falls back to
 * `ColorSwatch`'s own `hex: null` placeholder ring rather than disappearing.
 *
 * Dropped entirely when every bike in the comparison has zero colors — same
 * "nobody has a value" rule `buildOverviewGroup` applies to its own rows —
 * so `ComparisonTable` only renders this when at least one bike qualifies.
 */
export function ComparisonColorsRow({ bikes, gridTemplateColumns, colorSwatchIndex }: ComparisonColorsRowProps) {
  return (
    <ComparisonRowShell label="Colores" gridTemplateColumns={gridTemplateColumns}>
      {bikes.map((bike) =>
        bike.colors.length > 0 ? (
          <dd key={bike.slug} className="flex flex-wrap items-center gap-xs">
            <span className="sr-only">Colores: {bike.colors.join(", ")}</span>
            {bike.colors.map((color) => {
              const swatch = colorSwatchIndex.get(normalizeColorKey(color));
              return <ColorSwatch key={color} hex={swatch?.hex ?? null} secondaryHex={swatch?.secondaryHex} className="h-6 w-6" />;
            })}
          </dd>
        ) : (
          <dd key={bike.slug} className="font-body text-body text-negro">
            {MISSING}
          </dd>
        ),
      )}
    </ComparisonRowShell>
  );
}
