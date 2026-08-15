import type { SpecField, SpecGroup } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import {
  addField,
  addGroup,
  moveField,
  moveFieldTo,
  moveGroup,
  moveGroupTo,
  normalizeOrder,
  removeField,
  removeGroup,
  renameGroup,
  toggleFieldVisible,
  toggleGroupVisible,
  updateField,
} from "./spec-groups";

function group(title: string, order: number, fields: SpecGroup["fields"] = []): SpecGroup {
  return { title, order, visible: true, fields };
}

function field(label: string, value: string, order: number): SpecField {
  return { label, value, order, visible: true };
}

describe("addGroup", () => {
  it("appends a new group with the next order", () => {
    const groups = [group("Cuadro", 0)];
    const next = addGroup(groups, "Transmisión");

    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ title: "Transmisión", order: 1, visible: true, fields: [] });
  });
});

describe("renameGroup", () => {
  it("changes only the title of the targeted group", () => {
    const groups = [group("Cuadro", 0), group("Frenos", 1)];
    const next = renameGroup(groups, 0, "Cuadro y horquilla");

    expect(next[0]?.title).toBe("Cuadro y horquilla");
    expect(next[1]?.title).toBe("Frenos");
  });
});

describe("removeGroup", () => {
  it("drops the group and reindexes the remaining orders densely", () => {
    const groups = [group("Cuadro", 0), group("Transmisión", 1), group("Frenos", 2)];
    const next = removeGroup(groups, 1);

    expect(next.map((g) => g.title)).toEqual(["Cuadro", "Frenos"]);
    expect(next.map((g) => g.order)).toEqual([0, 1]);
  });
});

describe("moveGroup", () => {
  it("swaps a group with its neighbor in the requested direction", () => {
    const groups = [group("Cuadro", 0), group("Transmisión", 1), group("Frenos", 2)];

    const movedDown = moveGroup(groups, 0, 1);
    expect(movedDown.map((g) => g.title)).toEqual(["Transmisión", "Cuadro", "Frenos"]);
    expect(movedDown.map((g) => g.order)).toEqual([0, 1, 2]);

    const movedUp = moveGroup(groups, 2, -1);
    expect(movedUp.map((g) => g.title)).toEqual(["Cuadro", "Frenos", "Transmisión"]);
  });

  it("is a no-op past either edge", () => {
    const groups = [group("Cuadro", 0), group("Frenos", 1)];

    expect(moveGroup(groups, 0, -1)).toEqual(groups);
    expect(moveGroup(groups, 1, 1)).toEqual(groups);
  });
});

describe("moveGroupTo", () => {
  it("moves a group directly to an arbitrary target index, not just a neighbor", () => {
    const groups = [group("Cuadro", 0), group("Transmisión", 1), group("Frenos", 2), group("Ruedas", 3)];

    const next = moveGroupTo(groups, 0, 2);
    expect(next.map((g) => g.title)).toEqual(["Transmisión", "Frenos", "Cuadro", "Ruedas"]);
    expect(next.map((g) => g.order)).toEqual([0, 1, 2, 3]);
  });

  it("clamps an out-of-range target instead of rejecting the move", () => {
    const groups = [group("Cuadro", 0), group("Frenos", 1)];
    const next = moveGroupTo(groups, 0, 99);
    expect(next.map((g) => g.title)).toEqual(["Frenos", "Cuadro"]);
  });

  it("is a no-op when the target equals the source", () => {
    const groups = [group("Cuadro", 0), group("Frenos", 1)];
    expect(moveGroupTo(groups, 0, 0)).toEqual(groups);
  });
});

describe("addField / updateField / removeField / moveField", () => {
  const base = [group("Transmisión", 0, [field("Cassette", "SRAM XG-1275", 0)])];

  it("addField appends a field with the next order inside the targeted group only", () => {
    const groups = [group("Cuadro", 0), ...base];
    const next = addField(groups, 1, "Cadena", "SRAM XX1");

    expect(next[0]?.fields).toHaveLength(0);
    expect(next[1]?.fields).toHaveLength(2);
    expect(next[1]?.fields[1]).toEqual({ label: "Cadena", value: "SRAM XX1", order: 1, visible: true });
  });

  it("updateField patches label/value without touching order", () => {
    const next = updateField(base, 0, 0, { value: "SRAM XG-1299" });
    expect(next[0]?.fields[0]).toEqual({ label: "Cassette", value: "SRAM XG-1299", order: 0, visible: true });
  });

  it("removeField drops the field and reindexes the group's remaining fields densely", () => {
    const groups = [
      group("Transmisión", 0, [
        field("Cassette", "SRAM XG-1275", 0),
        field("Cadena", "SRAM XX1", 1),
        field("Desviador", "SRAM XX1 Eagle", 2),
      ]),
    ];
    const next = removeField(groups, 0, 1);

    expect(next[0]?.fields.map((f) => f.label)).toEqual(["Cassette", "Desviador"]);
    expect(next[0]?.fields.map((f) => f.order)).toEqual([0, 1]);
  });

  it("moveField reorders within its own group only", () => {
    const groups = [group("Transmisión", 0, [field("Cassette", "A", 0), field("Cadena", "B", 1)])];
    const next = moveField(groups, 0, 0, 1);
    expect(next[0]?.fields.map((f) => f.label)).toEqual(["Cadena", "Cassette"]);
  });

  it("moveFieldTo moves a field directly to an arbitrary target within its own group only", () => {
    const groups = [
      group("Cuadro", 0, [field("Material", "Carbono", 0)]),
      group("Transmisión", 1, [
        field("Cassette", "A", 0),
        field("Cadena", "B", 1),
        field("Desviador", "C", 2),
        field("Mandos", "D", 3),
      ]),
    ];

    const next = moveFieldTo(groups, 1, 0, 2);
    expect(next[1]?.fields.map((f) => f.label)).toEqual(["Cadena", "Desviador", "Cassette", "Mandos"]);
    expect(next[1]?.fields.map((f) => f.order)).toEqual([0, 1, 2, 3]);
    expect(next[0]?.fields.map((f) => f.label)).toEqual(["Material"]);
  });

  it("moveFieldTo clamps an out-of-range target instead of rejecting the move", () => {
    const groups = [group("Transmisión", 0, [field("Cassette", "A", 0), field("Cadena", "B", 1)])];
    const next = moveFieldTo(groups, 0, 0, 99);
    expect(next[0]?.fields.map((f) => f.label)).toEqual(["Cadena", "Cassette"]);
  });
});

/**
 * M10.6. Hiding is not deleting: a saved template is a superset, so a bike
 * that doesn't have the "Eléctrica" hardware turns those rows off and keeps
 * the shape for the next product.
 */
describe("toggleGroupVisible / toggleFieldVisible", () => {
  it("toggles a group without touching its siblings or its fields", () => {
    const groups = [group("Frenos", 0, [field("Delantero", "SRAM RED", 0)]), group("Eléctrica", 1)];

    const hidden = toggleGroupVisible(groups, 1);
    expect(hidden[1]?.visible).toBe(false);
    expect(hidden[0]?.visible).toBe(true);
    // The rows survive the group being hidden — that's the whole point.
    expect(hidden[0]?.fields).toHaveLength(1);

    expect(toggleGroupVisible(hidden, 1)[1]?.visible).toBe(true);
  });

  it("toggles a single field inside its own group only", () => {
    const groups = [
      group("Frenos", 0, [field("Delantero", "SRAM RED", 0), field("Trasero", "SRAM RED", 1)]),
      group("Cuadro", 1, [field("Material", "Carbono", 0)]),
    ];

    const next = toggleFieldVisible(groups, 0, 1);
    expect(next[0]?.fields[1]?.visible).toBe(false);
    expect(next[0]?.fields[0]?.visible).toBe(true);
    expect(next[1]?.fields[0]?.visible).toBe(true);
  });

  /**
   * The no-migration guarantee, mirrored on the client: a sheet loaded from a
   * document written before the flag existed arrives with `visible`
   * undefined. It has to read as visible, so the first toggle must *hide* it
   * rather than flip an absent value into `true` and appear to do nothing.
   */
  it("treats a missing flag as visible", () => {
    const legacy = [{ title: "Cuadro", order: 0, fields: [] } as unknown as SpecGroup];
    expect(toggleGroupVisible(legacy, 0)[0]?.visible).toBe(false);

    const legacyField = [
      { title: "Cuadro", order: 0, fields: [{ label: "Material", value: "Carbono", order: 0 }] } as unknown as SpecGroup,
    ];
    expect(toggleFieldVisible(legacyField, 0, 0)[0]?.fields[0]?.visible).toBe(false);
  });
});

describe("normalizeOrder", () => {
  it("reindexes any array of ordered items to a dense 0..n-1 sequence", () => {
    const items = [{ order: 5 }, { order: 9 }, { order: 2 }];
    expect(normalizeOrder(items).map((item) => item.order)).toEqual([0, 1, 2]);
  });
});
