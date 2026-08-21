"use client";

import { formatDay, parseLocalDay, startOfLocalDay } from "./chart-dates";
import { CHART_COLORS, CHART_MARKS } from "./chart-theme";

export interface ChartSeriesPoint {
  date: string;
  value: number;
}

export interface OrdersByDayChartProps {
  /** One point per calendar day in `range`, zero-filled — `OrdersStats.ordersByDay` never skips a day. */
  data: ChartSeriesPoint[];
  /** The full requested window (`OrdersStats.range`) — bars sit at their real day offset inside it. */
  range: { from: string; to: string };
  /** Full-precision label for the tooltip/hover title and labeled bars. */
  formatValue: (value: number) => string;
  /** Short label for the y-axis gridlines. Defaults to `formatValue`; pass a compact form for currency (`"$5k"`) so a full `"$500,000.00"` doesn't overflow the left padding. */
  formatAxisValue?: (value: number) => string;
  ariaLabel: string;
  /** Optional second line for a bar's native `<title>` — e.g. the order count behind a revenue point. */
  tooltipDetail?: (point: ChartSeriesPoint, index: number) => string | undefined;
  /**
   * Fixed gridline step (same unit as `data[].value`) instead of a scale
   * relative to this render's own max. A revenue chart whose ceiling moves
   * every time the data does is what made the axis unreadable across
   * renders — passing a stable step (e.g. $50,000 in cents) means the same
   * value always sits at the same height, chart to chart. Omit for a
   * dynamic max-relative scale (the previous default), still appropriate
   * for a count-style series with no natural round unit.
   */
  axisStep?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `WIDTH` is deliberately close to this chart's real rendered width, not an
 * arbitrary round number. Both instances of this chart live exclusively in
 * `HomeStats.tsx`'s `xl:grid-cols-2` two-up grid, where each card's content
 * box measures ~525-560px. The `<svg>` below renders at `width="100%"` with
 * `height="auto"`, so the browser scales the whole viewBox — text included —
 * by `renderedWidth / WIDTH`. With the old `WIDTH=800` that scale was ~0.65,
 * which silently shrank every `fontSize` below what it says in the source
 * (an `11` meant to read as DESIGN.md's 11px `caption` token rendered at
 * ~7px — off the type scale entirely). Keeping `WIDTH` near the real
 * container width keeps that scale near 1, so the `fontSize` values below
 * can be chosen directly against DESIGN.md §3's tokens instead of being
 * inflated to compensate for an unrelated shrink.
 */
const HEIGHT = 300;
const WIDTH = 560;
/**
 * `top` is not symmetric with `bottom`/`right` — it has to leave room for a
 * bar's value label to sit *above* the bar without clipping. When a bar's
 * value lands exactly on `maxValue` (its height fills the whole plot), the
 * label's baseline sits at `top - 8`; a 14px label's ascenders reach ~11px
 * above that baseline, so anything less than ~20px of top padding pushes the
 * glyph tops above `y=0` — past the `<svg>`'s edge, which clips by spec.
 * `32` leaves real clearance instead of the bare minimum.
 */
const PADDING = { top: 32, right: 16, bottom: 28, left: 64 };
const MAX_BAR_WIDTH = CHART_MARKS.barMaxThickness;
const MIN_BAR_WIDTH = 2;
/** Above this many bars, only a subset of x-axis day labels render — otherwise adjacent labels collide into an unreadable smear. */
const MAX_VISIBLE_DAY_LABELS = 8;
/** At or under this many bars, every bar gets its own value label — a Día/Semana window is short enough that "only the peak" would hide most of the story. */
const LABEL_EVERY_BAR_THRESHOLD = 14;
/**
 * Static half-width estimate for the longest value label this chart draws
 * (currency at `fontSize=14`, e.g. `"$287,000.00"`) — same "estimate, don't
 * measure" convention `RankedBarChart` uses for `MAX_LABEL_CHARS`. A bar
 * whose center falls within this distance of the plot's left/right edge
 * gets its label anchored to that edge instead of centered, so the label
 * text grows inward rather than overflowing past the axis margin.
 */
const EDGE_LABEL_MARGIN = 44;
/**
 * Hard cap on how many gridlines a fixed-`axisStep` chart draws. `axisStep`
 * is a constant sized for today's typical scale (`HomeStats.tsx`'s
 * `REVENUE_AXIS_STEP_CENTS`/`ACCESSORY_REVENUE_AXIS_STEP_CENTS`) — if the
 * data outgrows it, stepping by the raw `axisStep` forever draws more `<g>`
 * gridline groups than a card this size can hold, unbounded. `resolveAxisScale`
 * below widens the step to the smallest whole multiple of `axisStep` that
 * keeps the count under this cap, so the axis coarsens instead of the card
 * filling up with lines — a fixed step either way, never a scale relative to
 * this render's own peak (that invariant is what `axisStep` exists for).
 */
const MAX_GRID_TICKS = 8;

/**
 * `maxValue` (the bar-height ceiling) and `tickStep` (the gridline spacing)
 * both derive from `axisStep` and `rawMax` alone — never from anything
 * render-specific like pixel height — so two renders with the same data
 * always agree on both, and `maxValue` is always an exact multiple of
 * `tickStep` (the topmost gridline lands exactly on the ceiling, same as
 * before this cap existed).
 */
function resolveAxisScale(rawMax: number, axisStep: number): { maxValue: number; tickStep: number } {
  const roughMax = Math.max(axisStep, axisStep * Math.ceil(rawMax / axisStep));
  let multiplier = 1;
  while (roughMax / (axisStep * multiplier) > MAX_GRID_TICKS - 1) multiplier += 1;
  const tickStep = axisStep * multiplier;
  const maxValue = Math.max(tickStep, tickStep * Math.ceil(roughMax / tickStep));
  return { maxValue, tickStep };
}

/**
 * Discrete bars over real time, one per calendar day — `data` is zero-filled
 * by the backend (`orders.stats.ts`'s `enumerateStoreDays`), so bars sit at a
 * regular step with no unexplained gaps, replacing the sparse
 * active-days-only layout that used to leave most of a 30-day window blank.
 *
 * Single hue (grafito) except the highest bar, which alone carries the
 * dorado accent and a value label — same "#1 gets the emphasis" rule
 * `RankedBarChart` already established, applied here to "best day" instead
 * of "top of a ranking".
 */
export function OrdersByDayChart({
  data,
  range,
  formatValue,
  formatAxisValue = formatValue,
  ariaLabel,
  tooltipDetail,
  axisStep,
}: OrdersByDayChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  /**
   * `range.from`/`range.to` are exact instants, not day boundaries — a
   * "7d" preset resolves to `now - 7 days` through `now` (e.g. 11:08am
   * through 11:08am), not local midnight. Anchoring `xAt` to those raw
   * instants while every `data[].date` gets parsed as *local midnight* of
   * its day (`parseLocalDay`) introduces a systematic skew equal to
   * whatever time of day `range` was resolved at: early points compress
   * toward the left edge (their real offset is a fraction of a day, not a
   * full day), and the last real point never reaches the right edge (it
   * falls short by that same fraction) — both symptoms Manuel flagged
   * ("14/15 ago pegados", "espacio sobrando a la derecha"). Snapping both
   * ends to local midnight removes the intra-day component entirely.
   */
  const windowStart = startOfLocalDay(new Date(range.from));
  const windowEnd = startOfLocalDay(new Date(range.to));
  /**
   * `range.to` is exclusive of the day it names — an N-day window enumerates
   * N calendar days, so `(windowEnd - windowStart) / MS_PER_DAY` equals N,
   * the day *count*. But `xAt` needs the day-*step* count (N-1) for the
   * last of those N points to land exactly at `fraction = 1` (the plot's
   * right edge) — index 0 sits at the left edge and index N-1 spans N-1
   * steps to get there, not N. Using the day count as-is here is what left
   * the last real bar short of the right edge even after day-snapping alone.
   */
  const windowDays = Math.max((windowEnd - windowStart) / MS_PER_DAY - 1, 1);

  const rawMax = Math.max(...data.map((point) => point.value), 0);
  // A fixed step means the axis ceiling only ever grows to the next round
  // multiple of `axisStep` that covers the data — never shrinks, never
  // lands on an arbitrary per-render peak. `Math.max(1, ...)` keeps a
  // completely empty series from collapsing the axis to zero height.
  const { maxValue, tickStep } = axisStep
    ? resolveAxisScale(rawMax, axisStep)
    : { maxValue: Math.max(rawMax, 1), tickStep: undefined };
  const maxIndex = data.reduce((best, point, index) => (point.value > (data[best]?.value ?? -1) ? index : best), 0);

  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, (plotWidth / Math.max(data.length, 1)) * 0.6));
  const dayLabelEvery = Math.max(1, Math.ceil(data.length / MAX_VISIBLE_DAY_LABELS));
  const labelEveryBar = data.length <= LABEL_EVERY_BAR_THRESHOLD;
  const lastIndex = data.length - 1;
  const lastRegularDayIndex = Math.floor(lastIndex / dayLabelEvery) * dayLabelEvery;
  /**
   * The last day's label always renders (it's "today", the most relevant
   * point), regardless of the regular `dayLabelEvery` spacing — but the
   * nearest regular tick can land within a day or two of it. Two date
   * labels a day apart (~16px at 30 points) collide into unreadable
   * overlapping text ("19 ago"/"20 ago" reading as "19 a2gago") since
   * `formatDay` strings run 40-50px wide. Suppress that one regular tick
   * when it's closer than half a `dayLabelEvery` step to the true last day
   * — the last day's own label wins that slot instead of both fighting for it.
   */
  const suppressedDayIndex =
    lastRegularDayIndex !== lastIndex && lastIndex - lastRegularDayIndex < dayLabelEvery / 2 ? lastRegularDayIndex : -1;

  function xAt(point: ChartSeriesPoint): number {
    const offsetDays = (parseLocalDay(point.date).getTime() - windowStart) / MS_PER_DAY;
    const fraction = Math.min(Math.max(offsetDays / windowDays, 0), 1);
    return PADDING.left + fraction * plotWidth;
  }
  function barHeight(value: number): number {
    return Math.max((value / maxValue) * plotHeight, value > 0 ? 3 : 0);
  }
  /**
   * A value label centered (`textAnchor="middle"`) on a bar near the plot's
   * left/right edge overflows into the axis-label margin — the first day of
   * a window always sits at `x=PADDING.left`, so its centered label spills
   * left into the y-axis tick labels' own space. Anchoring to the edge
   * instead means the label grows inward, never past the margin it started
   * in, regardless of string length.
   */
  function labelAnchor(x: number): { x: number; anchor: "start" | "middle" | "end" } {
    if (x - PADDING.left < EDGE_LABEL_MARGIN) return { x: PADDING.left, anchor: "start" };
    if (WIDTH - PADDING.right - x < EDGE_LABEL_MARGIN) return { x: WIDTH - PADDING.right, anchor: "end" };
    return { x, anchor: "middle" };
  }

  const gridTicks = tickStep
    ? Array.from({ length: maxValue / tickStep + 1 }, (_, index) => index * tickStep)
    : [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(maxValue * fraction));

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={ariaLabel}
      >
        {gridTicks.map((tick) => {
          const y = PADDING.top + plotHeight - (tick / maxValue) * plotHeight;
          return (
            <g key={tick}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} stroke={CHART_COLORS.grid} strokeWidth={1} />
              <text x={PADDING.left - 8} y={y} dy={4} textAnchor="end" fontSize={12} fill={CHART_COLORS.axisText}>
                {formatAxisValue(tick)}
              </text>
            </g>
          );
        })}

        {data.map((point, index) => {
          const x = xAt(point);
          const height = barHeight(point.value);
          const isMax = index === maxIndex && point.value > 0;
          const showValueLabel = isMax || labelEveryBar;
          const label = labelAnchor(x);
          const detail = tooltipDetail?.(point, index);
          return (
            <g key={point.date}>
              <title>
                {formatDay(point.date)}: {formatValue(point.value)}
                {detail ? ` · ${detail}` : ""}
              </title>
              <rect
                x={x - barWidth / 2}
                y={PADDING.top + plotHeight - height}
                width={barWidth}
                height={height}
                rx={Math.min(CHART_MARKS.barRadius, barWidth / 2)}
                fill={isMax ? CHART_COLORS.highlight : CHART_COLORS.series}
              />
              {showValueLabel && point.value > 0 ? (
                <text
                  x={label.x}
                  y={PADDING.top + plotHeight - height - 8}
                  textAnchor={label.anchor}
                  fontSize={isMax ? 14 : 12}
                  fontWeight={isMax ? 500 : 400}
                  fill={isMax ? CHART_COLORS.valueLabel : CHART_COLORS.axisText}
                >
                  {formatValue(point.value)}
                </text>
              ) : null}
              {(index % dayLabelEvery === 0 && index !== suppressedDayIndex) || index === lastIndex ? (
                <text x={x} y={HEIGHT - 8} textAnchor="middle" fontSize={12} fill={CHART_COLORS.axisText}>
                  {formatDay(point.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
