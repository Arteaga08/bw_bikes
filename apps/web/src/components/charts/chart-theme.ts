/**
 * Every color/size constant a chart in this system may use, in one place —
 * so no chart file ever writes a hex literal of its own.
 *
 * Colors are CSS custom properties, not duplicated hex: Tailwind's `@theme`
 * in `globals.css` already emits `--color-grafito`, `--color-dorado`, etc.
 * as real custom properties, so referencing them here means a future token
 * change propagates to every chart automatically.
 *
 * There is deliberately no categorical palette. Running this project's
 * tokens through the `dataviz` skill's validator failed grafito+dorado as a
 * categorical pair (below the chroma floor and the CVD separation floor),
 * and the system has no other hues to spend — so no chart in M11 plots more
 * than one series. `highlight` exists for exactly one case: the single #1
 * bar of a ranked list, always paired with a visible value label (dorado's
 * own 1.82:1 contrast on white needs that relief).
 */
export const CHART_COLORS = {
  series: "var(--color-grafito)",
  highlight: "var(--color-dorado)",
  grid: "var(--color-borde)",
  axisText: "var(--color-grafito)",
  tooltipBg: "var(--color-surface)",
  tooltipBorder: "var(--color-borde)",
} as const;

/** Mark specs from the `dataviz` skill's fixed set — never derived per-chart. */
export const CHART_MARKS = {
  lineWidth: 2,
  barMaxThickness: 24,
  barRadius: 4,
  /** A wash, never a saturated block — the area under a single-series line. */
  areaOpacity: 0.1,
} as const;
