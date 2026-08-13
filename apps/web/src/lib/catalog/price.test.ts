import { describe, expect, it } from "vitest";
import { centsToPriceInput, MAX_PRICE_CENTS, parsePriceToCents } from "./price";

describe("parsePriceToCents", () => {
  it("parses a plain pesos amount to integer cents", () => {
    expect(parsePriceToCents("1000")).toBe(100_000);
    expect(parsePriceToCents("19999.90")).toBe(1_999_990);
  });

  it("strips thousands commas and a leading $", () => {
    expect(parsePriceToCents("$19,999.90")).toBe(1_999_990);
  });

  it("rounds to the nearest cent", () => {
    expect(parsePriceToCents("10.005")).toBe(1001);
  });

  it("returns null for an empty or whitespace-only input", () => {
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("   ")).toBeNull();
  });

  it("returns null for a non-numeric input", () => {
    expect(parsePriceToCents("abc")).toBeNull();
  });

  it("returns null for a negative amount", () => {
    expect(parsePriceToCents("-5")).toBeNull();
  });

  it("returns null over MAX_PRICE_CENTS", () => {
    expect(parsePriceToCents("1000001")).toBeNull();
    expect(parsePriceToCents(String(MAX_PRICE_CENTS / 100))).toBe(MAX_PRICE_CENTS);
  });
});

describe("centsToPriceInput", () => {
  it("formats integer cents as a plain two-decimal string", () => {
    expect(centsToPriceInput(1_999_990)).toBe("19999.90");
    expect(centsToPriceInput(100_000)).toBe("1000.00");
  });

  it("round-trips through parsePriceToCents", () => {
    expect(parsePriceToCents(centsToPriceInput(1_999_990))).toBe(1_999_990);
  });
});
