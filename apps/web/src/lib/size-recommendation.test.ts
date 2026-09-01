import type { PublicSizeGuideEntry } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { recommendSize } from "./size-recommendation";

const GUIDE: PublicSizeGuideEntry[] = [
  { value: "S", minHeightCm: 160, maxHeightCm: 172 },
  { value: "M", minHeightCm: 170, maxHeightCm: 180 },
  { value: "L", minHeightCm: 178, maxHeightCm: 190 },
];

describe("recommendSize", () => {
  it("returns undefined for an empty guide", () => {
    expect(recommendSize([], 175, "balanced")).toBeUndefined();
  });

  it("returns the single size that fits, with no secondary", () => {
    // 165 only fits "S" (160-172) — "M" starts at 170.
    expect(recommendSize(GUIDE, 165, "balanced")).toEqual({ primary: "S" });
  });

  it("extrapolates to the nearest size below the shortest range", () => {
    expect(recommendSize(GUIDE, 140, "balanced")).toEqual({ primary: "S" });
  });

  it("extrapolates to the nearest size above the tallest range", () => {
    expect(recommendSize(GUIDE, 210, "balanced")).toEqual({ primary: "L" });
  });

  describe("overlapping ranges — 179cm fits both M (170-180) and L (178-190)", () => {
    it("comfortable picks the smaller of the two overlapping sizes", () => {
      expect(recommendSize(GUIDE, 179, "comfortable")).toEqual({ primary: "M", secondary: "L" });
    });

    it("performance picks the larger of the two overlapping sizes", () => {
      expect(recommendSize(GUIDE, 179, "performance")).toEqual({ primary: "L", secondary: "M" });
    });

    it("balanced picks whichever range is centered closest to the height (M's midpoint 175 beats L's 184)", () => {
      expect(recommendSize(GUIDE, 179, "balanced")).toEqual({ primary: "M", secondary: "L" });
    });

    it("balanced can prefer the larger size when its midpoint is the closer one", () => {
      // "M" (160-180, midpoint 170) against a narrow "L" (178-182, midpoint
      // 180): at 179 (inside both ranges) "L" is centered closer (1 vs 9).
      const narrowGuide: PublicSizeGuideEntry[] = [
        { value: "M", minHeightCm: 160, maxHeightCm: 180 },
        { value: "L", minHeightCm: 178, maxHeightCm: 182 },
      ];
      expect(recommendSize(narrowGuide, 179, "balanced")).toEqual({ primary: "L", secondary: "M" });
    });
  });

  it("doesn't depend on the guide's input order", () => {
    const shuffled = [GUIDE[2]!, GUIDE[0]!, GUIDE[1]!];
    expect(recommendSize(shuffled, 165, "balanced")).toEqual({ primary: "S" });
  });
});
