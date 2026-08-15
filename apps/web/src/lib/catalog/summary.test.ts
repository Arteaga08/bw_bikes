import type { SummaryRow } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { MAX_SUMMARY_ROWS, addRow, moveRow, removeRow, updateRow } from "./summary";

function row(label: string, value: string, order: number): SummaryRow {
  return { label, value, order };
}

const BASE = [row("Uso", "Carreras XC", 0), row("Peso", "9.6 kg", 1)];

describe("addRow", () => {
  it("appends a row with the next order", () => {
    const next = addRow(BASE, "Cuadro", "Carbono FACT 12m");

    expect(next).toHaveLength(3);
    expect(next[2]).toEqual({ label: "Cuadro", value: "Carbono FACT 12m", order: 2 });
  });

  /** The cap is what keeps the card a summary instead of a second spec sheet. */
  it("refuses to grow past the cap", () => {
    const full = Array.from({ length: MAX_SUMMARY_ROWS }, (_, index) => row(`Dato ${index}`, "x", index));

    expect(addRow(full, "Uno más", "y")).toBe(full);
  });
});

describe("updateRow", () => {
  it("patches label/value of the targeted row without touching order", () => {
    const next = updateRow(BASE, 1, { value: "9.2 kg" });

    expect(next[1]).toEqual({ label: "Peso", value: "9.2 kg", order: 1 });
    expect(next[0]).toEqual(BASE[0]);
  });
});

describe("removeRow", () => {
  it("drops the row and reindexes the rest densely", () => {
    const rows = [...BASE, row("Cuadro", "Carbono", 2)];
    const next = removeRow(rows, 1);

    expect(next.map((r) => r.label)).toEqual(["Uso", "Cuadro"]);
    expect(next.map((r) => r.order)).toEqual([0, 1]);
  });
});

describe("moveRow", () => {
  it("swaps a row with its neighbor and reindexes", () => {
    const next = moveRow(BASE, 0, 1);

    expect(next.map((r) => r.label)).toEqual(["Peso", "Uso"]);
    expect(next.map((r) => r.order)).toEqual([0, 1]);
  });

  it("is a no-op past either edge", () => {
    expect(moveRow(BASE, 0, -1)).toEqual(BASE);
    expect(moveRow(BASE, 1, 1)).toEqual(BASE);
  });
});
