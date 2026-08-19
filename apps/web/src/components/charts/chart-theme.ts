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
 *
 * A second rule this project only measured for the Inicio redesign
 * (2026-08): the `estado-*` tokens clear WCAG AA (4.48:1 / 5.19:1) as
 * **text on `surface`**, but fail the 3:1 UI floor as **adjacent fills**
 * (~1.2–1.8:1) — see DESIGN.md §2, "Codificación de datos". `estado-*`
 * therefore never joins `CHART_COLORS`: it stays out of SVG fills entirely
 * and is applied the same way it already is everywhere else in this system
 * (`Badge`, `StatCard`'s hint line) — as a Tailwind text-color utility
 * (`text-estado-exito`/`text-estado-error`), always paired with a glyph, on
 * `DeltaIndicator`'s delta text. Direction encoding is a property of *text*
 * in this system, not of a chart mark.
 */
export const CHART_COLORS = {
  series: "var(--color-grafito)",
  highlight: "var(--color-dorado)",
  grid: "var(--color-borde)",
  axisText: "var(--color-grafito)",
  /** The #1 bar's value label — full negro, not `axisText`'s grafito, so the one number this chart calls out reads with the same weight as the highlight bar it sits beside. */
  valueLabel: "var(--color-negro)",
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
