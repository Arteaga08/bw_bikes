import type { PublicSizeGuideEntry } from "@bw-bikes/shared";

/**
 * How a shopper prefers to ride — the SmartFit-style tie-breaker for when
 * their height falls inside two sizes' overlapping ranges. `"comfortable"`
 * favors the smaller frame (shorter reach, more upright), `"performance"`
 * the larger one (longer reach, more aerodynamic); `"balanced"` picks
 * whichever range's midpoint sits closest to the rider's actual height. This
 * mapping is the one place the tie-break rule lives — flip it here, nothing
 * else changes.
 */
export type RideStyle = "comfortable" | "balanced" | "performance";

export interface SizeRecommendation {
  /** The recommended size's value, e.g. "M". */
  primary: string;
  /**
   * A second size that fits the rider's height just as validly — shown
   * alongside `primary` (mirrors Merida SmartFit's two-up result) so the
   * shopper can see the alternative the style pick resolved between.
   * `undefined` when only one size fits, or none does.
   */
  secondary?: string;
}

function midpoint(entry: PublicSizeGuideEntry): number {
  return (entry.minHeightCm + entry.maxHeightCm) / 2;
}

function fitsHeight(entry: PublicSizeGuideEntry, heightCm: number): boolean {
  return heightCm >= entry.minHeightCm && heightCm <= entry.maxHeightCm;
}

/** Distance from `heightCm` to the nearest edge of `entry`'s range — 0 when it already fits. */
function distanceToRange(entry: PublicSizeGuideEntry, heightCm: number): number {
  if (heightCm < entry.minHeightCm) return entry.minHeightCm - heightCm;
  if (heightCm > entry.maxHeightCm) return heightCm - entry.maxHeightCm;
  return 0;
}

/**
 * Recommends a size for a given rider height, resolving ties between
 * overlapping ranges with `style`. `guide` is expected pre-resolved (category
 * overrides already applied) and can be in any order — this sorts by
 * `minHeightCm` itself so it never depends on the caller's `order`.
 *
 * A height outside every range doesn't return nothing: it extrapolates to
 * whichever size is closest (SmartFit does the same rather than telling a
 * very tall or very short shopper "no size for you"). Returns `undefined`
 * only when the guide itself is empty.
 */
export function recommendSize(
  guide: PublicSizeGuideEntry[],
  heightCm: number,
  style: RideStyle,
): SizeRecommendation | undefined {
  if (guide.length === 0) return undefined;

  const sorted = [...guide].sort((a, b) => a.minHeightCm - b.minHeightCm);
  const fits = sorted.filter((entry) => fitsHeight(entry, heightCm));

  if (fits.length === 0) {
    const nearest = sorted.reduce((closest, entry) =>
      distanceToRange(entry, heightCm) < distanceToRange(closest, heightCm) ? entry : closest,
    );
    return { primary: nearest.value };
  }

  if (fits.length === 1) {
    return { primary: fits[0]!.value };
  }

  const smaller = fits[0]!;
  const larger = fits[fits.length - 1]!;

  if (style === "comfortable") return { primary: smaller.value, secondary: larger.value };
  if (style === "performance") return { primary: larger.value, secondary: smaller.value };

  // "balanced": whichever range is centered closest to the actual height.
  const centered = fits.reduce((closest, entry) =>
    Math.abs(midpoint(entry) - heightCm) < Math.abs(midpoint(closest) - heightCm) ? entry : closest,
  );
  const other = centered === smaller ? larger : smaller;
  return { primary: centered.value, secondary: other.value };
}
