"use client";

import { CHART_COLORS, CHART_MARKS } from "./chart-theme";

export interface RankedBarChartItem {
  label: string;
  count: number;
  /** "Bici"/"Accesorio" tag before the label — omit for rankings with no product type (e.g. sizes). */
  itemType?: "bike" | "accessory";
  /** Revenue for this row, shown alongside `count` on every row and in every row's tooltip — omit for rankings with no money attached (e.g. "most viewed"). */
  revenueCents?: number;
  formatRevenue?: (cents: number) => string;
}

export interface RankedBarChartProps {
  items: RankedBarChartItem[];
}

const ROW_HEIGHT = 44;
const LABEL_WIDTH = 200;
const MAX_LABEL_CHARS = 26;
/** Bar track width — the space the longest bar can fill. */
const BAR_AREA_WIDTH = 130;
/**
 * Fixed right-hand column for the value label, wide enough for this
 * system's longest realistic string ("12 uds · $372,000.00" at
 * `fontSize=13`, ~145px) with margin. The label's `x` is anchored to
 * `width` (below), never to a per-row `barLength` — that decoupling is what
 * fixes the old clipping bug: an SVG root clips content past its `viewBox`
 * by spec, and a label positioned right after a long bar had no guarantee
 * of fitting inside `viewBox`'s right edge.
 */
const VALUE_WIDTH = 170;
const PADDING = { top: 4, bottom: 4 };
const BAR_HEIGHT = CHART_MARKS.barMaxThickness;

const TYPE_TAG: Record<"bike" | "accessory", string> = { bike: "Bici", accessory: "Accesorio" };

/**
 * Horizontal ranked bars — modelos/tallas más vistos/vendidos. Hand-rolled
 * SVG, same reasoning as `OrdersByDayChart`: no charting library, since
 * Recharts fails Next's build-time page-data collection regardless of
 * version (see that file's doc comment).
 *
 * Single hue (grafito) except the #1 bar, which alone carries the dorado
 * accent — this system has no categorical palette to spend on ten distinct
 * series colors, and a ranked list's story is "which one is #1", which
 * emphasis tells better than color-coding all ten ever would.
 *
 * Every row gets its own value label (units, plus revenue when present) —
 * at Manuel's explicit request, reverting an earlier version of this
 * component that labeled only the #1 row per a generic dataviz skill's
 * "label selectively, let `<title>` carry the rest" guideline. That
 * guideline isn't wrong in general, but it isn't this project's call to
 * make: a ranking a reader can't read without hovering doesn't communicate,
 * and DESIGN.md §2's rule for this chart only requires that the #1 bar
 * carry a labeled value — it never says the other rows can't. The #1 bar
 * keeps the only dorado accent and the heavier weight/size (`ui` vs
 * `caption` in DESIGN.md §3); the rest label in grafito, one step down.
 *
 * `itemType`/`revenueCents` are both optional per-item: a sizes ranking has
 * neither, "most viewed" has a type but no money, "most sold" has both — the
 * component adapts its row content rather than three near-duplicate charts.
 */
export function RankedBarChart({ items }: RankedBarChartProps) {
  const height = PADDING.top + PADDING.bottom + items.length * ROW_HEIGHT;
  const maxCount = Math.max(...items.map((item) => item.count), 1);
  const width = LABEL_WIDTH + BAR_AREA_WIDTH + VALUE_WIDTH;

  function barWidth(count: number): number {
    return Math.max((count / maxCount) * BAR_AREA_WIDTH, count > 0 ? 3 : 0);
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="Ranking"
    >
      {items.map((item, index) => {
        const y = PADDING.top + index * ROW_HEIGHT;
        const rowCenter = y + ROW_HEIGHT / 2;
        const isTop = index === 0;
        const barLength = barWidth(item.count);
        const displayLabel = item.itemType ? `${TYPE_TAG[item.itemType]} · ${item.label}` : item.label;
        const revenueLabel = item.revenueCents !== undefined ? (item.formatRevenue ?? String)(item.revenueCents) : undefined;
        const valueLabel = `${item.count} ${item.count === 1 ? "ud" : "uds"}${revenueLabel ? ` · ${revenueLabel}` : ""}`;

        return (
          <g key={`${item.itemType ?? ""}-${item.label}`}>
            <title>
              {displayLabel}: {item.count} {item.count === 1 ? "unidad" : "unidades"}
              {revenueLabel ? ` · ${revenueLabel}` : ""}
            </title>
            <text
              x={LABEL_WIDTH - 8}
              y={rowCenter}
              dy={4}
              textAnchor="end"
              fontSize={12}
              fill={CHART_COLORS.axisText}
            >
              {displayLabel.length > MAX_LABEL_CHARS ? `${displayLabel.slice(0, MAX_LABEL_CHARS - 1)}…` : displayLabel}
            </text>
            <rect
              x={LABEL_WIDTH}
              y={rowCenter - BAR_HEIGHT / 2}
              width={barLength}
              height={BAR_HEIGHT}
              rx={CHART_MARKS.barRadius}
              fill={isTop ? CHART_COLORS.highlight : CHART_COLORS.series}
            />
            <text
              x={width - 4}
              y={rowCenter}
              dy={4}
              textAnchor="end"
              fontSize={isTop ? 13 : 12}
              fontWeight={isTop ? 500 : 400}
              fill={isTop ? CHART_COLORS.valueLabel : CHART_COLORS.axisText}
            >
              {valueLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
