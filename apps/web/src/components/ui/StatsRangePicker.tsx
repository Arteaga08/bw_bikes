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

const PRESETS: StatsPreset[] = ["today", "7d", "30d", "90d", "custom"];

const PRESET_LABELS: Record<StatsPreset, string> = {
  today: "Hoy",
  "7d": "7 días",
  "30d": "30 días",
  "90d": "90 días",
  custom: "Personalizado",
};

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
