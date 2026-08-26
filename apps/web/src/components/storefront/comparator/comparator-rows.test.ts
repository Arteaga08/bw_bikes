import { describe, expect, it } from "vitest";
import type { ComparableBike } from "@/lib/api/public-catalog";
import { buildComparison } from "./comparator-rows";

function makeBike(
  specGroups: ComparableBike["specGroups"],
  overrides: Partial<ComparableBike> = {},
): ComparableBike {
  return {
    id: "1",
    slug: "tarmac",
    name: "Tarmac SL7",
    brandName: "Specialized",
    price: 3_890_000,
    specGroups,
    ...overrides,
  };
}

describe("buildComparison", () => {
  it("pairs values that share a group title and a label", () => {
    const left = makeBike([{ title: "Transmisión", fields: [{ label: "Grupo", value: "Ultegra Di2" }] }]);
    const right = makeBike([{ title: "Transmisión", fields: [{ label: "Grupo", value: "Claris" }] }]);

    expect(buildComparison(left, right)).toEqual([
      { title: "Transmisión", rows: [{ label: "Grupo", left: "Ultegra Di2", right: "Claris" }] },
    ]);
  });

  it("leaves the other side undefined when only one bike declares a label", () => {
    const left = makeBike([
      { title: "Cuadro", fields: [{ label: "Material", value: "Carbono" }, { label: "Peso", value: "7.9 kg" }] },
    ]);
    const right = makeBike([{ title: "Cuadro", fields: [{ label: "Material", value: "Aluminio" }] }]);

    const [group] = buildComparison(left, right);
    expect(group?.rows).toEqual([
      { label: "Material", left: "Carbono", right: "Aluminio" },
      { label: "Peso", left: "7.9 kg" },
    ]);
  });

  it("keeps the left bike's order and appends labels only the right bike has", () => {
    const left = makeBike([{ title: "Cuadro", fields: [{ label: "Material", value: "Carbono" }] }]);
    const right = makeBike([
      { title: "Cuadro", fields: [{ label: "Horquilla", value: "FACT" }, { label: "Material", value: "Aluminio" }] },
    ]);

    const [group] = buildComparison(left, right);
    expect(group?.rows.map((row) => row.label)).toEqual(["Material", "Horquilla"]);
  });

  it("appends groups that only the right bike has, with an empty left column", () => {
    const left = makeBike([{ title: "Cuadro", fields: [{ label: "Material", value: "Carbono" }] }]);
    const right = makeBike([
      { title: "Cuadro", fields: [{ label: "Material", value: "Aluminio" }] },
      { title: "Sistema eléctrico", fields: [{ label: "Motor", value: "Brose" }] },
    ]);

    expect(buildComparison(left, right).map((group) => group.title)).toEqual(["Cuadro", "Sistema eléctrico"]);
    expect(buildComparison(left, right)[1]?.rows).toEqual([{ label: "Motor", right: "Brose" }]);
  });

  it("drops a row whose value is blank on both sides", () => {
    const left = makeBike([
      { title: "Cuadro", fields: [{ label: "Material", value: "Carbono" }, { label: "Pintura", value: "   " }] },
    ]);
    const right = makeBike([{ title: "Cuadro", fields: [{ label: "Pintura", value: "" }] }]);

    const [group] = buildComparison(left, right);
    expect(group?.rows).toEqual([{ label: "Material", left: "Carbono" }]);
  });

  it("drops a group left with no rows at all", () => {
    const left = makeBike([{ title: "Cuadro", fields: [{ label: "Pintura", value: "" }] }]);
    const right = makeBike([{ title: "Cuadro", fields: [{ label: "Pintura", value: "  " }] }]);

    expect(buildComparison(left, right)).toEqual([]);
  });

  it("matches labels on their trimmed form but never across case", () => {
    const left = makeBike([{ title: "Cuadro", fields: [{ label: "  Peso  ", value: "7.9 kg" }] }]);
    const right = makeBike([
      { title: "Cuadro", fields: [{ label: "Peso", value: "10.2 kg" }, { label: "peso", value: "otro" }] },
    ]);

    const [group] = buildComparison(left, right);
    expect(group?.rows).toEqual([
      { label: "Peso", left: "7.9 kg", right: "10.2 kg" },
      { label: "peso", right: "otro" },
    ]);
  });

  it("returns nothing when neither bike has a published sheet", () => {
    expect(buildComparison(makeBike([]), makeBike([]))).toEqual([]);
  });
});
