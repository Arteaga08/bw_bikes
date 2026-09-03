import type { ComparableBike } from "@/lib/api/public-catalog";
import { ComparisonHeader } from "./ComparisonHeader";
import { buildComparison, buildOverviewGroup } from "./comparison-rows";

export interface ComparisonTableProps {
  bikes: ComparableBike[];
}

/** Pinta cuando ni siquiera hay algo que comparar. Rows always includes `Precio` (`buildOverviewGroup`) once at least one bike is passed in, so this only fires from `ComparisonPage`'s own empty state, never here — kept as a defensive fallback rather than an assumption the caller always holds. */
const MISSING = "—";

/**
 * The full comparison table: `ComparisonHeader` (photo/name/price/CTA) as
 * its first row, then "Ficha general" (año, precio, tallas — the facts every
 * bike carries) followed by whatever free-form ficha técnica each bike
 * actually has (`buildComparison`).
 *
 * Every "row" here is its own `display: grid` sharing one literal
 * `gridTemplateColumns` string (not one giant grid spanning the whole
 * table) — the same "row-by-row `<dl>` with a repeated column template"
 * shape the old two-bike `ComparatorSpecs` used, generalized to N columns.
 * A single `overflow-x-auto` wraps the whole stack, so every row scrolls
 * in lockstep instead of drifting out of alignment with its neighbors.
 *
 * `overflow-y-hidden` alongside `overflow-x-auto` matters, not just tidiness:
 * per the CSS Overflow spec, `overflow-x: auto` promotes an otherwise-
 * `visible` `overflow-y` to `auto` too, which traps the mouse wheel inside
 * the table the moment it can scroll horizontally (`ScrollRail.tsx`
 * documents the same fix). `lg:overflow-visible` turns scrolling off from
 * `lg` up — three columns already fit a desktop viewport — which is also
 * what lets `ComparisonHeader`'s `lg:sticky` actually stick to the
 * viewport: `position: sticky` inside a horizontally-scrolling ancestor
 * anchors to *that* ancestor, not the page, so the sticky behavior only
 * works once scrolling is off.
 *
 * `min-w-max` on the inner wrapper is what actually forces the overflow:
 * a block-level child defaults to filling its scrollable parent's width,
 * which would let the grid's own column tracks (10rem + `bikes.length ×
 * minmax(15rem, 1fr)`) shrink below their floor instead of triggering the
 * scrollbar.
 */
export function ComparisonTable({ bikes }: ComparisonTableProps) {
  const gridTemplateColumns = `10rem repeat(${bikes.length}, minmax(15rem, 1fr))`;
  const groups = [buildOverviewGroup(bikes), ...buildComparison(bikes)].filter((group) => group.rows.length > 0);

  return (
    <div className="mt-xl overflow-x-auto overflow-y-hidden lg:overflow-visible">
      <div className="min-w-max">
        <ComparisonHeader bikes={bikes} gridTemplateColumns={gridTemplateColumns} />

        <div className="flex flex-col gap-xl py-lg">
          {groups.map((group) => (
            <section key={group.title}>
              <h2 className="px-lg font-ui text-eyebrow uppercase text-grafito">{group.title}</h2>
              <dl className="mt-md flex flex-col">
                {group.rows.map((row) => (
                  <div
                    key={row.label}
                    className="grid gap-lg border-t border-borde px-lg py-md"
                    style={{ gridTemplateColumns }}
                  >
                    <dt className="sticky left-0 bg-blanco font-body text-caption uppercase text-grafito">{row.label}</dt>
                    {row.values.map((value, index) => (
                      <dd key={bikes[index]!.slug} className="font-body text-body text-negro">
                        <span className="sr-only">{bikes[index]!.name}: </span>
                        {value ?? MISSING}
                      </dd>
                    ))}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
