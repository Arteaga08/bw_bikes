/**
 * How many bikes the comparator accepts, shared between server and client.
 *
 * Lives outside `ComparisonProvider.tsx` on purpose: that module starts with
 * `"use client"`, and a Server Component importing a plain constant across
 * that boundary gets `undefined` back instead of the value (Turbopack/React
 * only proxies client *references* across the boundary, not plain data) —
 * exactly what silently broke `/comparar`'s `bikes.length >=
 * MIN_COMPARISON_ENTRIES` check, which always read `bikes.length >=
 * undefined` (always `false`) and rendered the empty state no matter how
 * many bikes actually loaded. `ComparisonProvider.tsx` re-exports both
 * constants from here so every existing client import keeps working.
 */
export const MAX_COMPARISON_ENTRIES = 3;
/** Fewer than 2 selections isn't a comparison yet — "Comparar" stays disabled until this. */
export const MIN_COMPARISON_ENTRIES = 2;
