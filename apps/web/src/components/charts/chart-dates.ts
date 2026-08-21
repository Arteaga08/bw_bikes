const DAY_FORMATTER = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

/**
 * `date` arrives as a bare `"YYYY-MM-DD"` string. Parsing it with `new
 * Date(string)` reads it as UTC midnight, which in every Mexican timezone
 * (all behind UTC) displays as the *previous* evening — split it and build
 * a local-time `Date` instead.
 */
export function parseLocalDay(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

export function formatDay(isoDate: string): string {
  return DAY_FORMATTER.format(parseLocalDay(isoDate));
}

/**
 * Snaps a `Date` (usually built from a full ISO instant, not a bare
 * `"YYYY-MM-DD"`) down to local midnight of the day it falls on. Unlike
 * `parseLocalDay`, this takes an already-parsed instant — for a value like
 * `range.from`/`range.to`, which carry a real time-of-day (e.g. "now") that
 * needs to be discarded before comparing it, in whole days, against dates
 * built with `parseLocalDay`.
 */
export function startOfLocalDay(date: Date): number {
  const snapped = new Date(date);
  snapped.setHours(0, 0, 0, 0);
  return snapped.getTime();
}
