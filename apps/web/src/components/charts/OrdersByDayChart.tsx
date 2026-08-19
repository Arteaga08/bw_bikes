"use client";

import { CHART_COLORS, CHART_MARKS } from "./chart-theme";

export interface ChartSeriesPoint {
  date: string;
  value: number;
}

export interface OrdersByDayChartProps {
  /** Sparse — only days with at least one order, per `OrdersStats.ordersByDay`. Never zero-padded. */
  data: ChartSeriesPoint[];
  /** The full requested window (`OrdersStats.range`) — bars sit at their real day offset inside it, so empty days stay visibly empty rather than being pulled adjacent to their neighbors. */
  range: { from: string; to: string };
  /** Full-precision label for the tooltip/hover title and the highlighted bar's value. */
  formatValue: (value: number) => string;
  /** Short label for the y-axis gridlines. Defaults to `formatValue`; pass a compact form for currency (`"$5k"`) so a full `"$500,000.00"` doesn't overflow the left padding. */
  formatAxisValue?: (value: number) => string;
  ariaLabel: string;
  /** Optional second line for a bar's native `<title>` — e.g. the order count behind a revenue point. */
  tooltipDetail?: (point: ChartSeriesPoint, index: number) => string | undefined;
}

const DAY_FORMATTER = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `date` arrives as a bare `"YYYY-MM-DD"` string. Parsing it with `new
 * Date(string)` reads it as UTC midnight, which in every Mexican timezone
 * (all behind UTC) displays as the *previous* evening — split it and build
 * a local-time `Date` instead.
 */
function parseLocalDay(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

function formatDay(isoDate: string): string {
  return DAY_FORMATTER.format(parseLocalDay(isoDate));
}

const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 56 };
const BAR_WIDTH = CHART_MARKS.barMaxThickness;
const WIDTH = 800;

/**
 * Discrete bars over real time, not a continuous line. Replaces the
 * area/line chart M11 shipped (Inicio redesign, 2026-08): with this store's
 * order volume, a 30-day window can have as few as 3-4 active days — a line
 * interpolates a slope across the empty days between them, which draws a
 * trend that was never there. A bar exists only where `data` has a point
 * (the backend never zero-pads `ordersByDay`), positioned at its real
 * fractional offset into `[range.from, range.to]` — so the empty stretch of
 * the window reads as empty space, not as compressed-away gaps the way
 * evenly-spacing the points by index would.
 *
 * Single hue (grafito) except the highest bar, which alone carries the
 * dorado accent and a value label — same "#1 gets the emphasis" rule
 * `RankedBarChart` already established, applied here to "best day" instead
 * of "top of a ranking". Every other bar stays unlabeled with a native
 * `<title>` on hover, the same restraint `RankedBarChart`'s non-#1 rows use.
 */
export function OrdersByDayChart({
  data,
  range,
  formatValue,
  formatAxisValue = formatValue,
  ariaLabel,
  tooltipDetail,
}: OrdersByDayChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const windowStart = new Date(range.from).getTime();
  const windowEnd = new Date(range.to).getTime();
  const windowDays = Math.max((windowEnd - windowStart) / MS_PER_DAY, 1);

  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const maxIndex = data.reduce((best, point, index) => (point.value > (data[best]?.value ?? -1) ? index : best), 0);

  function xAt(point: ChartSeriesPoint): number {
    const offsetDays = (parseLocalDay(point.date).getTime() - windowStart) / MS_PER_DAY;
    const fraction = Math.min(Math.max(offsetDays / windowDays, 0), 1);
    return PADDING.left + fraction * plotWidth;
  }
  function barHeight(value: number): number {
    return Math.max((value / maxValue) * plotHeight, value > 0 ? 3 : 0);
  }

  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(maxValue * fraction));

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label={ariaLabel}>
        {gridTicks.map((tick) => {
          const y = PADDING.top + plotHeight - (tick / maxValue) * plotHeight;
          return (
            <g key={tick}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} stroke={CHART_COLORS.grid} strokeWidth={1} />
              <text x={PADDING.left - 8} y={y} dy={4} textAnchor="end" fontSize={11} fill={CHART_COLORS.axisText}>
                {formatAxisValue(tick)}
              </text>
            </g>
          );
        })}

        {/* The window's empty baseline — most of it, by construction, since `data` only carries active days. */}
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={PADDING.top + plotHeight}
          y2={PADDING.top + plotHeight}
          stroke={CHART_COLORS.grid}
          strokeWidth={1}
          strokeDasharray="2 4"
        />

        {data.map((point, index) => {
          const x = xAt(point);
          const height = barHeight(point.value);
          const isMax = index === maxIndex;
          const detail = tooltipDetail?.(point, index);
          return (
            <g key={point.date}>
              <title>
                {formatDay(point.date)}: {formatValue(point.value)}
                {detail ? ` · ${detail}` : ""}
              </title>
              <rect
                x={x - BAR_WIDTH / 2}
                y={PADDING.top + plotHeight - height}
                width={BAR_WIDTH}
                height={height}
                rx={CHART_MARKS.barRadius}
                fill={isMax ? CHART_COLORS.highlight : CHART_COLORS.series}
              />
              {isMax ? (
                <text
                  x={x}
                  y={PADDING.top + plotHeight - height - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={500}
                  fill={CHART_COLORS.valueLabel}
                >
                  {formatValue(point.value)}
                </text>
              ) : null}
              <text x={x} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_COLORS.axisText}>
                {formatDay(point.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
