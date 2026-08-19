import { CHART_COLORS, CHART_MARKS } from "./chart-theme";

export interface SparklinePoint {
  date: string;
  value: number;
}

export interface SparklineProps {
  points: SparklinePoint[];
  /** Accessible label — the sparkline itself carries no axis or tooltip, so this is the only description a screen reader gets. */
  ariaLabel: string;
}

const WIDTH = 96;
const HEIGHT = 28;
const PADDING_Y = 3;

/** Below this, a line reads as noise rather than a trend — see DESIGN.md §2, "Codificación de datos". */
const MIN_POINTS = 4;

/**
 * A trend, not a chart: no axis, no gridlines, no tooltip — embedded inside
 * a `StatCard` to answer "is this climbing or flat" at a glance. Single
 * series in `CHART_COLORS.series`, same token every other chart in this
 * system uses for magnitude, so a sparkline never reads as a second visual
 * language next to `OrdersByDayChart`.
 *
 * Renders nothing below `MIN_POINTS` — this store has ~12 orders in a
 * 30-day window; a 2-point line drawn across a tile would imply a trend the
 * data doesn't support. `ChartCard`'s empty-state precedent doesn't apply
 * here (a sparkline lives inside a `StatCard`, not a `ChartCard`), so the
 * caller decides whether to omit the slot entirely.
 */
export function Sparkline({ points, ariaLabel }: SparklineProps) {
  if (points.length < MIN_POINTS) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const plotHeight = HEIGHT - PADDING_Y * 2;

  function xAt(index: number): number {
    return (index / (points.length - 1)) * WIDTH;
  }
  function yAt(value: number): number {
    // A flat series (range === 0) draws a flat line through the middle
    // rather than dividing by zero.
    if (range === 0) return HEIGHT / 2;
    return PADDING_Y + plotHeight - ((value - min) / range) * plotHeight;
  }

  const linePoints = points.map((point, index) => `${xAt(index)},${yAt(point.value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} role="img" aria-label={ariaLabel}>
      <polyline
        points={linePoints}
        fill="none"
        stroke={CHART_COLORS.series}
        strokeWidth={CHART_MARKS.lineWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
