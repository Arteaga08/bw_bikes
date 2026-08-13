import type { FulfillmentMode } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { ALL_FULFILLMENT_MODES, FULFILLMENT_MODE_BADGE_VARIANTS, FULFILLMENT_MODE_LABELS } from "./labels";

const EXPECTED_FULFILLMENT_MODES: FulfillmentMode[] = ["in_stock", "on_request", "preorder"];

describe("FulfillmentMode labels", () => {
  it("has a Spanish label and a Badge variant for all three modes", () => {
    for (const mode of EXPECTED_FULFILLMENT_MODES) {
      expect(FULFILLMENT_MODE_LABELS[mode]).toBeTruthy();
      expect(FULFILLMENT_MODE_BADGE_VARIANTS[mode]).toBeTruthy();
    }
    expect(ALL_FULFILLMENT_MODES.sort()).toEqual([...EXPECTED_FULFILLMENT_MODES].sort());
  });
});
