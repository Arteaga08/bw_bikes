import type { CSSProperties } from "react";
import type { ComparableBike, PublicColorSwatch } from "@/lib/api/public-catalog";
import { ComparisonHeader } from "./ComparisonHeader";
import { ComparisonScroller } from "./ComparisonScroller";
import { ComparisonColorsRow, ComparisonImageRow } from "./ComparisonOverviewRows";
import { ComparisonTextRow } from "./ComparisonRow";
import { buildComparison, buildOverviewGroup } from "./comparison-rows";

export interface ComparisonTableProps {
  bikes: ComparableBike[];
  colorSwatchIndex: Map<string, PublicColorSwatch>;
}

/**
 * Horizontal chrome the mobile strip can't spend on bikes: the page's own
 * `px-lg` (24px each side) plus each row's `px-md` (16px each side).
 */
const MOBILE_CHROME = "5rem";
/** Gap between two adjacent bike columns on mobile (`gap-md`). */
const MOBILE_GAP = "1rem";
/** How much of the third bike stays on screen at rest — the cue that says "esto se desliza". */
const MOBILE_PEEK = "2.5rem";

/**
 * The mobile column track. Two bikes get the whole strip split evenly (no
 * scroll at all — both fit); three get a narrower track deliberately sized so
 * two columns and a slice of the third land inside the viewport, which is the
 * only affordance telling the shopper there *is* a third bike to swipe to.
 * `max(8rem, …)` is the floor for very narrow phones — below it the strip
 * scrolls rather than squeezing a photo into nothing.
 */
function mobileColumnTrack(count: number): string {
  const reserved = count > 2 ? `calc(${MOBILE_CHROME} + ${MOBILE_GAP} * 2 + ${MOBILE_PEEK})` : `calc(${MOBILE_CHROME} + ${MOBILE_GAP})`;
  return `max(8rem, calc((100vw - ${reserved}) / 2))`;
}

/**
 * The full comparison table: `ComparisonHeader` (name/price/CTA, sticky) as
 * its first row, then "Ficha general" — photo, colors, año, precio, tallas,
 * the facts every bike carries — followed by whatever free-form ficha
 * técnica each bike actually has (`buildComparison`).
 *
 * Every "row" here is its own `display: grid` sharing one column template
 * (not one giant grid spanning the whole table) — the same "row-by-row `<dl>`
 * with a repeated column template" shape the old two-bike `ComparatorSpecs`
 * used, generalized to N columns. The template is published here as two CSS
 * variables and consumed by an arbitrary-property utility with an `lg:`
 * variant, rather than passed down as an inline style, because the two
 * layouts are genuinely different grids, not one grid at two sizes:
 *
 * - `--comparison-columns` (from `lg` up): `10rem` label column + one
 *   `minmax(15rem, 1fr)` track per bike. Everything fits a desktop viewport.
 * - `--comparison-columns-mobile`: no label column at all — `ComparisonRowShell`
 *   moves the label above the row there — and fixed-width bike tracks sized by
 *   `mobileColumnTrack` so a phone shows two bikes plus a peek of the third
 *   instead of the label column plus most of one bike.
 *
 * `ComparisonScroller` owns the scrolling itself: one scrollport around the
 * whole row stack, so every row scrolls in lockstep instead of drifting out
 * of alignment with its neighbors, plus the pinned header it keeps in sync
 * horizontally — see that file for why the header can't just be `sticky`
 * inside the scrollport.
 */
export function ComparisonTable({ bikes, colorSwatchIndex }: ComparisonTableProps) {
  const columns = {
    "--comparison-columns": `10rem repeat(${bikes.length}, minmax(15rem, 1fr))`,
    "--comparison-columns-mobile": `repeat(${bikes.length}, ${mobileColumnTrack(bikes.length)})`,
  } as CSSProperties;
  const overviewGroup = buildOverviewGroup(bikes);
  const specGroups = buildComparison(bikes).filter((group) => group.rows.length > 0);
  // Same "nobody has a value" rule the rest of `buildOverviewGroup`'s own rows follow — dropped instead of a row of nothing but dashes.
  const showColorsRow = bikes.some((bike) => bike.colors.length > 0);

  return (
    <ComparisonScroller style={columns} header={<ComparisonHeader bikes={bikes} />}>
      <div className="flex flex-col gap-xl py-lg">
        <section>
          <h2 className="px-md font-ui text-eyebrow uppercase text-grafito lg:px-lg">
            {/* Pinned like every row label: the group title has to stay readable while the strip scrolls sideways. */}
            <span className="sticky left-0 inline-block bg-blanco pr-sm lg:static lg:pr-0">{overviewGroup.title}</span>
          </h2>
          <dl className="mt-md flex flex-col">
            <ComparisonImageRow bikes={bikes} />
            {showColorsRow ? <ComparisonColorsRow bikes={bikes} colorSwatchIndex={colorSwatchIndex} /> : null}
            {overviewGroup.rows.map((row) => (
              <ComparisonTextRow key={row.label} row={row} bikes={bikes} />
            ))}
          </dl>
        </section>

        {specGroups.map((group) => (
          <section key={group.title}>
            <h2 className="px-md font-ui text-eyebrow uppercase text-grafito lg:px-lg">
              <span className="sticky left-0 inline-block bg-blanco pr-sm lg:static lg:pr-0">{group.title}</span>
            </h2>
            <dl className="mt-md flex flex-col">
              {group.rows.map((row) => (
                <ComparisonTextRow key={row.label} row={row} bikes={bikes} />
              ))}
            </dl>
          </section>
        ))}
      </div>
    </ComparisonScroller>
  );
}
