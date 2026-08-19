"use client";

import { CHART_COLORS, CHART_MARKS } from "./chart-theme";

export interface RankedBarChartItem {
  label: string;
  count: number;
}

export interface RankedBarChartProps {
  items: RankedBarChartItem[];
}

const ROW_HEIGHT = 32;
const LABEL_WIDTH = 140;
const PADDING = { top: 4, right: 44, bottom: 4 };
const BAR_HEIGHT = CHART_MARKS.barMaxThickness;

/**
 * Horizontal ranked bars — modelos/tallas más vistos/vendidos. Hand-rolled
 * SVG, same reasoning as `OrdersByDayChart`: no charting library, since
 * Recharts fails Next's build-time page-data collection regardless of
 * version (see that file's doc comment).
 *
 * Single hue (grafito) except the #1 bar, which alone carries the dorado
 * accent and its value label — this system has no categorical palette to
 * spend on ten distinct series colors, and a ranked list's story is "which
 * one is #1", which emphasis tells better than color-coding all ten ever
 * would. Every other bar stays unlabeled on purpose (the `dataviz` skill's
 * "label selectively" rule) — the axis category name plus the relative bar
 * length already carries the comparison; a `<title>` gives the exact value
 * on hover without printing it on every row.
 */
export function RankedBarChart({ items }: RankedBarChartProps) {
  const height = PADDING.top + PADDING.bottom + items.length * ROW_HEIGHT;
  const maxCount = Math.max(...items.map((item) => item.count), 1);
  const barAreaWidth = 240;
  const width = LABEL_WIDTH + barAreaWidth + PADDING.right;

  function barWidth(count: number): number {
    return Math.max((count / maxCount) * barAreaWidth, count > 0 ? 3 : 0);
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Ranking">
      {items.map((item, index) => {
        const y = PADDING.top + index * ROW_HEIGHT;
        const rowCenter = y + ROW_HEIGHT / 2;
        const isTop = index === 0;
        const barLength = barWidth(item.count);

        return (
          <g key={item.label}>
            <title>
              {item.label}: {item.count}
            </title>
            <text
              x={LABEL_WIDTH - 8}
              y={rowCenter}
              dy={4}
              textAnchor="end"
              fontSize={12}
              fill={CHART_COLORS.axisText}
            >
              {item.label.length > 18 ? `${item.label.slice(0, 17)}…` : item.label}
            </text>
            <rect
              x={LABEL_WIDTH}
              y={rowCenter - BAR_HEIGHT / 2}
              width={barLength}
              height={BAR_HEIGHT}
              rx={CHART_MARKS.barRadius}
              fill={isTop ? CHART_COLORS.highlight : CHART_COLORS.series}
            />
            {isTop ? (
              <text
                x={LABEL_WIDTH + barLength + 6}
                y={rowCenter}
                dy={4}
                fontSize={13}
                fontWeight={500}
                fill={CHART_COLORS.valueLabel}
              >
                {item.count}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
