import { formatDay } from "./chart-dates";
import { CHART_COLORS, CHART_MARKS } from "./chart-theme";

export interface SparklinePoint {
  date: string;
  value: number;
}

export interface SparklineProps {
  points: SparklinePoint[];
  /** Accessible label for the `<svg>`. */
  ariaLabel: string;
  /** Formats the min/max/last values shown in text around the line. Defaults to the raw number. */
  formatValue?: (value: number) => string;
}

const WIDTH = 200;
const HEIGHT = 40;
const PADDING_Y = 3;

/** Below this, a line reads as noise rather than a trend — see DESIGN.md §2, "Codificación de datos". */
const MIN_POINTS = 4;

/**
 * A trend, with just enough context to read it without hovering: a baseline
 * at zero, the series' min/max, and the date span it covers. Single series
 * in `CHART_COLORS.series`, same token every other chart in this system uses
 * for magnitude, so a sparkline never reads as a second visual language next
 * to `OrdersByDayChart`.
 *
 * This used to ship with no axis, no gridlines, no tooltip at all — a
 * generic dataviz skill's "a trend, not a chart" minimalism taken further
 * than this project asked for. Manuel's read on the result: a line with a
 * single trailing number doesn't explain anything. This isn't a full
 * `OrdersByDayChart`-style axis (there still isn't room for one at a
 * `StatCard`'s scale), but a baseline + min/max + period gives a reader
 * enough to place the line without guessing.
 *
 * The line itself is still scaled from **zero**, not from the series' own
 * minimum — a min/max-normalized line makes a 100→110 series swing
 * top-to-bottom exactly like a 10→8,000 one, which is what made the old
 * sparkline (before even the trailing-number version) read as meaningless
 * noise instead of a trend (2026-08 Inicio redesign). Scaling from zero
 * means amplitude is honest: a nearly-flat line really is nearly flat
 * relative to the value, not just relative to itself.
 *
 * Renders nothing below `MIN_POINTS` — this store has ~12 orders in a
 * 30-day window; a 2-point line drawn across a tile would imply a trend the
 * data doesn't support. `ChartCard`'s empty-state precedent doesn't apply
 * here (a sparkline lives inside a `StatCard`, not a `ChartCard`), so the
 * caller decides whether to omit the slot entirely.
 */
export function Sparkline({ points, ariaLabel, formatValue = String }: SparklineProps) {
  if (points.length < MIN_POINTS) return null;

  const values = points.map((point) => point.value);
  // `max` floors at 0 because it also drives the y-scale below (`yAt`) — a
  // series with no positive values still needs a non-negative ceiling to
  // scale against. `min` has no such role: it's display-only (the "Mín"
  // caption), so it stays the series' real minimum, not floored at 0 — a
  // revenue series that never dips below $500 should say "Mín $500", not
  // "Mín $0".
  const max = Math.max(...values, 0);
  const min = Math.min(...values);
  const plotHeight = HEIGHT - PADDING_Y * 2;

  function xAt(index: number): number {
    return (index / (points.length - 1)) * WIDTH;
  }
  function yAt(value: number): number {
    // Every value is zero (max === 0) draws a flat line along the baseline
    // rather than dividing by zero — that's an honest "nothing happened",
    // not a rendering artifact.
    if (max === 0) return HEIGHT - PADDING_Y;
    return PADDING_Y + plotHeight - (value / max) * plotHeight;
  }

  const linePoints = points.map((point, index) => `${xAt(index)},${yAt(point.value)}`).join(" ");
  const lastPoint = points[points.length - 1]!;
  const lastLabel = formatValue(lastPoint.value);
  const periodLabel = `${formatDay(points[0]!.date)} – ${formatDay(lastPoint.date)}`;
  const rangeLabel = `Mín ${formatValue(min)} · Máx ${formatValue(max)}`;
  const baselineY = yAt(0);

  return (
    <span className="flex flex-col items-start gap-xs">
      <span className="font-body text-caption text-grafito" aria-hidden="true">
        {periodLabel}
      </span>
      <span className="inline-flex items-center gap-xs">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: `${WIDTH}px`, maxWidth: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label={ariaLabel}
        >
          <line x1={0} x2={WIDTH} y1={baselineY} y2={baselineY} stroke={CHART_COLORS.grid} strokeWidth={1} />
          <polyline
            points={linePoints}
            fill="none"
            stroke={CHART_COLORS.series}
            strokeWidth={CHART_MARKS.lineWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={xAt(points.length - 1)} cy={yAt(lastPoint.value)} r={2.5} fill={CHART_COLORS.series} />
        </svg>
        <span className="font-body text-caption text-grafito" aria-hidden="true">
          {lastLabel}
        </span>
      </span>
      <span className="font-body text-caption text-grafito" aria-hidden="true">
        {rangeLabel}
      </span>
    </span>
  );
}
