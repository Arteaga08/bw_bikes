"use client";

import type { StatsPreset } from "@bw-bikes/shared";
import { useState } from "react";
import { Input } from "./Input";
import { Tab, TabList } from "./Tabs";

export interface StatsRangeValue {
  preset: StatsPreset;
  /** Only meaningful — and only both present together — when `preset === "custom"`. */
  from?: string;
  to?: string;
}

export interface StatsRangePickerProps {
  value: StatsRangeValue;
  onChange: (value: StatsRangeValue) => void;
}

// Only the four calendar units Manuel asked for, plus Personalizado —
// "90d" stays a valid `StatsPreset` for the backend/type (nothing forces a
// tab to exist for every preset value) but is deliberately not surfaced
// here.
const PRESETS: StatsPreset[] = ["today", "7d", "30d", "365d", "custom"];

/**
 * Relabeled from raw durations ("7 días", "30 días") to the calendar units
 * they actually approximate — a merchant thinks "this week" / "this month",
 * not "the last 168 hours". The underlying preset values (`"7d"`, `"30d"`)
 * are untouched: only the label changed, so every consumer of `StatsRangeValue`
 * keeps working unmodified.
 */
const PRESET_LABELS: Record<StatsPreset, string> = {
  today: "Día",
  "7d": "Semana",
  "30d": "Mes",
  "90d": "Trimestre",
  "365d": "Año",
  custom: "Personalizado",
};
// `PRESET_LABELS` still covers every `StatsPreset` (including the
// UI-hidden "90d") since the type requires an exhaustive record — only
// `PRESETS` decides which tabs actually render.

/**
 * The date-window control shared by Inicio and Analítica — mirrors
 * `statsRangeQuerySchema`/`parseStatsRange`: five presets, "Personalizado"
 * only fires once both bounds are set with `from < to`.
 *
 * `TabList`/`Tab`, not `ButtonGroup`: this switches the content below it
 * (the KPIs, the chart) — exactly what `Tab`'s own doc comment reserves the
 * component for, as opposed to `ButtonGroup`'s independent actions (a
 * reorder stepper, a −/+ control).
 */
export function StatsRangePicker({ value, onChange }: StatsRangePickerProps) {
  // A local draft so a half-typed date never fires `onChange` with a range
  // the backend would reject — the parent only ever sees a valid pair.
  const [draftFrom, setDraftFrom] = useState(value.from ?? "");
  const [draftTo, setDraftTo] = useState(value.to ?? "");

  const bothFilled = draftFrom !== "" && draftTo !== "";
  const isOutOfOrder = bothFilled && draftFrom >= draftTo;

  function selectPreset(preset: StatsPreset): void {
    if (preset !== "custom") {
      onChange({ preset });
      return;
    }
    onChange(bothFilled && !isOutOfOrder ? { preset, from: draftFrom, to: draftTo } : { preset });
  }

  function handleDraftChange(next: { from?: string; to?: string }): void {
    const nextFrom = next.from ?? draftFrom;
    const nextTo = next.to ?? draftTo;
    if (next.from !== undefined) setDraftFrom(next.from);
    if (next.to !== undefined) setDraftTo(next.to);

    if (nextFrom !== "" && nextTo !== "" && nextFrom < nextTo) {
      onChange({ preset: "custom", from: nextFrom, to: nextTo });
    }
  }

  return (
    <div className="flex flex-col gap-sm">
      <TabList label="Rango de fechas">
        {PRESETS.map((preset) => (
          <Tab key={preset} selected={value.preset === preset} onSelect={() => selectPreset(preset)}>
            {PRESET_LABELS[preset]}
          </Tab>
        ))}
      </TabList>
      {value.preset === "custom" ? (
        <div className="flex flex-wrap items-end gap-sm pt-xs">
          <Input
            type="date"
            label="Desde"
            value={draftFrom}
            onChange={(event) => handleDraftChange({ from: event.target.value })}
            wrapperClassName="w-40"
          />
          <Input
            type="date"
            label="Hasta"
            value={draftTo}
            onChange={(event) => handleDraftChange({ to: event.target.value })}
            error={isOutOfOrder ? '"Desde" debe ser anterior a "hasta".' : undefined}
            wrapperClassName="w-40"
          />
        </div>
      ) : null}
    </div>
  );
}
