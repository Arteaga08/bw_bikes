import { describe, expect, it } from "vitest";
import { formatCurrencyCents, formatCurrencyCentsWithCurrency } from "./format";

describe("formatCurrencyCents", () => {
  it("formats integer cents as MXN currency", () => {
    expect(formatCurrencyCents(25_000_00)).toBe("$25,000.00");
  });

  it("handles zero", () => {
    expect(formatCurrencyCents(0)).toBe("$0.00");
  });
});

describe("formatCurrencyCentsWithCurrency", () => {
  it("appends the currency code so it's never implicit", () => {
    expect(formatCurrencyCentsWithCurrency(25_000_00)).toBe("$25,000.00 MXN");
  });
});
