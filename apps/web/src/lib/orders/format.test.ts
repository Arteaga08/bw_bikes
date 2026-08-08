import { describe, expect, it } from "vitest";
import { formatCurrencyCents, formatDateTime } from "./format";

describe("formatCurrencyCents", () => {
  it("formats integer cents as MXN currency", () => {
    expect(formatCurrencyCents(25_000_00)).toBe("$25,000.00");
  });

  it("handles zero", () => {
    expect(formatCurrencyCents(0)).toBe("$0.00");
  });
});

describe("formatDateTime", () => {
  it("formats an ISO timestamp without throwing", () => {
    expect(formatDateTime("2026-08-07T15:30:00.000Z")).toMatch(/2026/);
  });
});
