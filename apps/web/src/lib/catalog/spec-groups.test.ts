import type { SpecGroup } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import {
  addField,
  addGroup,
  moveField,
  moveGroup,
  normalizeOrder,
  removeField,
  removeGroup,
  renameGroup,
  updateField,
} from "./spec-groups";

function group(title: string, order: number, fields: SpecGroup["fields"] = []): SpecGroup {
  return { title, order, fields };
}

describe("addGroup", () => {
  it("appends a new group with the next order", () => {
    const groups = [group("Cuadro", 0)];
    const next = addGroup(groups, "Transmisión");

    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ title: "Transmisión", order: 1, fields: [] });
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

describe("addField / updateField / removeField / moveField", () => {
  const base = [group("Transmisión", 0, [{ label: "Cassette", value: "SRAM XG-1275", order: 0 }])];

  it("addField appends a field with the next order inside the targeted group only", () => {
    const groups = [group("Cuadro", 0), ...base];
    const next = addField(groups, 1, "Cadena", "SRAM XX1");

    expect(next[0]?.fields).toHaveLength(0);
    expect(next[1]?.fields).toHaveLength(2);
    expect(next[1]?.fields[1]).toEqual({ label: "Cadena", value: "SRAM XX1", order: 1 });
  });

  it("updateField patches label/value without touching order", () => {
    const next = updateField(base, 0, 0, { value: "SRAM XG-1299" });
    expect(next[0]?.fields[0]).toEqual({ label: "Cassette", value: "SRAM XG-1299", order: 0 });
  });

  it("removeField drops the field and reindexes the group's remaining fields densely", () => {
    const groups = [
      group("Transmisión", 0, [
        { label: "Cassette", value: "SRAM XG-1275", order: 0 },
        { label: "Cadena", value: "SRAM XX1", order: 1 },
        { label: "Desviador", value: "SRAM XX1 Eagle", order: 2 },
      ]),
    ];
    const next = removeField(groups, 0, 1);

    expect(next[0]?.fields.map((f) => f.label)).toEqual(["Cassette", "Desviador"]);
    expect(next[0]?.fields.map((f) => f.order)).toEqual([0, 1]);
  });

  it("moveField reorders within its own group only", () => {
    const groups = [
      group("Transmisión", 0, [
        { label: "Cassette", value: "A", order: 0 },
        { label: "Cadena", value: "B", order: 1 },
      ]),
    ];
    const next = moveField(groups, 0, 0, 1);
    expect(next[0]?.fields.map((f) => f.label)).toEqual(["Cadena", "Cassette"]);
  });
});

describe("normalizeOrder", () => {
  it("reindexes any array of ordered items to a dense 0..n-1 sequence", () => {
    const items = [{ order: 5 }, { order: 9 }, { order: 2 }];
    expect(normalizeOrder(items).map((item) => item.order)).toEqual([0, 1, 2]);
  });
});
