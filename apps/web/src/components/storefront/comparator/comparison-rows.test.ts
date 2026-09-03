import { describe, expect, it } from "vitest";
import type { ComparableBike } from "@/lib/api/public-catalog";
import { buildComparison, buildOverviewGroup } from "./comparison-rows";

function makeBike(specGroups: ComparableBike["specGroups"], overrides: Partial<ComparableBike> = {}): ComparableBike {
  return {
    id: "1",
    slug: "tarmac",
    name: "Tarmac SL7",
    brandName: "Specialized",
    price: 3_890_000,
    sizes: [],
    colors: [],
    specGroups,
    ...overrides,
  };
}

describe("buildComparison", () => {
  it("pairs values that share a group title and a label, for two bikes", () => {
    const left = makeBike([{ title: "Transmisión", fields: [{ label: "Grupo", value: "Ultegra Di2" }] }]);
    const right = makeBike([{ title: "Transmisión", fields: [{ label: "Grupo", value: "Claris" }] }]);

    expect(buildComparison([left, right])).toEqual([
      { title: "Transmisión", rows: [{ label: "Grupo", values: ["Ultegra Di2", "Claris"] }] },
    ]);
  });

  it("aligns three bikes on a shared label, one column per bike", () => {
    const a = makeBike([{ title: "Transmisión", fields: [{ label: "Grupo", value: "Ultegra Di2" }] }]);
    const b = makeBike([{ title: "Transmisión", fields: [{ label: "Grupo", value: "Claris" }] }]);
    const c = makeBike([{ title: "Transmisión", fields: [{ label: "Grupo", value: "105" }] }]);

    expect(buildComparison([a, b, c])).toEqual([
      { title: "Transmisión", rows: [{ label: "Grupo", values: ["Ultegra Di2", "Claris", "105"] }] },
    ]);
  });

  it("leaves a column undefined when that bike doesn't declare the label", () => {
    const left = makeBike([
      { title: "Cuadro", fields: [{ label: "Material", value: "Carbono" }, { label: "Peso", value: "7.9 kg" }] },
    ]);
    const right = makeBike([{ title: "Cuadro", fields: [{ label: "Material", value: "Aluminio" }] }]);

    const [group] = buildComparison([left, right]);
    expect(group?.rows).toEqual([
      { label: "Material", values: ["Carbono", "Aluminio"] },
      { label: "Peso", values: ["7.9 kg", undefined] },
    ]);
  });

  it("keeps the first bike's order and appends labels only a later bike has", () => {
    const first = makeBike([{ title: "Cuadro", fields: [{ label: "Material", value: "Carbono" }] }]);
    const second = makeBike([
      { title: "Cuadro", fields: [{ label: "Horquilla", value: "FACT" }, { label: "Material", value: "Aluminio" }] },
    ]);

    const [group] = buildComparison([first, second]);
    expect(group?.rows.map((row) => row.label)).toEqual(["Material", "Horquilla"]);
  });

  it("appends a group only the third bike has, with the first two columns undefined", () => {
    const a = makeBike([{ title: "Cuadro", fields: [{ label: "Material", value: "Carbono" }] }]);
    const b = makeBike([{ title: "Cuadro", fields: [{ label: "Material", value: "Aluminio" }] }]);
    const c = makeBike([
      { title: "Cuadro", fields: [{ label: "Material", value: "Titanio" }] },
      { title: "Sistema eléctrico", fields: [{ label: "Motor", value: "Brose" }] },
    ]);

    const groups = buildComparison([a, b, c]);
    expect(groups.map((group) => group.title)).toEqual(["Cuadro", "Sistema eléctrico"]);
    expect(groups[1]?.rows).toEqual([{ label: "Motor", values: [undefined, undefined, "Brose"] }]);
  });

  it("drops a row whose value is blank on every bike", () => {
    const left = makeBike([
      { title: "Cuadro", fields: [{ label: "Material", value: "Carbono" }, { label: "Pintura", value: "   " }] },
    ]);
    const right = makeBike([{ title: "Cuadro", fields: [{ label: "Pintura", value: "" }] }]);

    const [group] = buildComparison([left, right]);
    expect(group?.rows).toEqual([{ label: "Material", values: ["Carbono", undefined] }]);
  });

  it("drops a group left with no rows at all", () => {
    const left = makeBike([{ title: "Cuadro", fields: [{ label: "Pintura", value: "" }] }]);
    const right = makeBike([{ title: "Cuadro", fields: [{ label: "Pintura", value: "  " }] }]);

    expect(buildComparison([left, right])).toEqual([]);
  });

  it("matches labels on their trimmed form but never across case", () => {
    const left = makeBike([{ title: "Cuadro", fields: [{ label: "  Peso  ", value: "7.9 kg" }] }]);
    const right = makeBike([
      { title: "Cuadro", fields: [{ label: "Peso", value: "10.2 kg" }, { label: "peso", value: "otro" }] },
    ]);

    const [group] = buildComparison([left, right]);
    expect(group?.rows).toEqual([
      { label: "Peso", values: ["7.9 kg", "10.2 kg"] },
      { label: "peso", values: [undefined, "otro"] },
    ]);
  });

  it("returns nothing when no bike has a published sheet", () => {
    expect(buildComparison([makeBike([]), makeBike([])])).toEqual([]);
  });
});

describe("buildOverviewGroup", () => {
  it("always carries Precio, since it's never optional on a bike", () => {
    const group = buildOverviewGroup([makeBike([], { price: 1_000_00 }), makeBike([], { price: 2_000_00 })]);
    const precio = group.rows.find((row) => row.label === "Precio");
    expect(precio?.values).toEqual(["$1,000.00", "$2,000.00"]);
  });

  it("omits 'Precio anterior' entirely when no bike in the comparison has one", () => {
    const group = buildOverviewGroup([makeBike([]), makeBike([])]);
    expect(group.rows.find((row) => row.label === "Precio anterior")).toBeUndefined();
  });

  it("includes 'Precio anterior' with a dash for the bike that doesn't have one", () => {
    const group = buildOverviewGroup([
      makeBike([], { compareAtPrice: 5_000_00 }),
      makeBike([]),
    ]);
    const row = group.rows.find((row) => row.label === "Precio anterior");
    expect(row?.values).toEqual(["$5,000.00", undefined]);
  });

  it("renders 'Año del modelo' with a dash for a bike with no model year on file", () => {
    const group = buildOverviewGroup([makeBike([], { modelYear: 2026 }), makeBike([])]);
    const row = group.rows.find((row) => row.label === "Año del modelo");
    expect(row?.values).toEqual(["2026", undefined]);
  });

  it("joins a bike's sizes with a middle dot", () => {
    const group = buildOverviewGroup([makeBike([], { sizes: ["S", "M", "L"] }), makeBike([])]);
    const row = group.rows.find((row) => row.label === "Tallas disponibles");
    expect(row?.values).toEqual(["S · M · L", undefined]);
  });

  it("drops 'Tallas disponibles' when no bike has any sized variant", () => {
    const group = buildOverviewGroup([makeBike([]), makeBike([])]);
    expect(group.rows.find((row) => row.label === "Tallas disponibles")).toBeUndefined();
  });
});
