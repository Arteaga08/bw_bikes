import type { StatsPreset, StatsRange } from "@bw-bikes/shared";
import { AppError } from "./app-error.js";

/**
 * Resolves the admin stats panel's shared date window
 * (BACKEND_ARCHITECTURE_GUIDELINES.md's "resolve once, reuse everywhere" —
 * same role `parseListQuery` plays for pagination). Every module endpoint
 * and `/admin/stats/overview` call this **once** per request and hand the
 * same `StatsRange` to every stats function, so two charts on one panel can
 * never disagree about what "last 7 days" means.
 *
 * Deliberately narrow: this resolves `{ preset, from, to }` only. It never
 * touches a Mongo filter — each stats module builds its own query from the
 * resolved bounds, the same division of labour `parseListQuery` draws for
 * business filters.
 */

const DEFAULT_PRESET: StatsPreset = "30d";

/** A window wider than this is not "recent activity", it's the whole history — and an unbounded scan. */
const MAX_RANGE_DAYS = 365;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function presetToBounds(preset: Exclude<StatsPreset, "custom">, now: Date): { from: Date; to: Date } {
  const to = now;
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to };
    case "7d":
      return { from: new Date(now.getTime() - 7 * MS_PER_DAY), to };
    case "30d":
      return { from: new Date(now.getTime() - 30 * MS_PER_DAY), to };
    case "90d":
      return { from: new Date(now.getTime() - 90 * MS_PER_DAY), to };
  }
}

/**
 * `query` is whatever `statsRangeQuerySchema` already whitelisted and
 * coerced — this function only ever sees `preset`/`from`/`to`, never a raw
 * client object, matching `parseListQuery`'s own contract.
 */
export function parseStatsRange(query: Record<string, unknown>, now: Date = new Date()): StatsRange {
  const rawPreset = query["preset"];
  const preset: StatsPreset = typeof rawPreset === "string" ? (rawPreset as StatsPreset) : DEFAULT_PRESET;

  if (preset === "custom") {
    const rawFrom = query["from"];
    const rawTo = query["to"];

    if (typeof rawFrom !== "string" || typeof rawTo !== "string") {
      throw new AppError('Un rango "custom" requiere "from" y "to".', 400);
    }

    const from = new Date(rawFrom);
    const to = new Date(rawTo);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new AppError('"from" y "to" deben ser fechas válidas.', 400);
    }
    if (from >= to) {
      throw new AppError('"from" debe ser anterior a "to".', 400);
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * MS_PER_DAY) {
      throw new AppError(`El rango no puede exceder ${MAX_RANGE_DAYS} días.`, 400);
    }

    return { preset, from: from.toISOString(), to: to.toISOString() };
  }

  const { from, to } = presetToBounds(preset, now);
  return { preset, from: from.toISOString(), to: to.toISOString() };
}
