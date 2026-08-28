import type { SpecGroup, SpecTemplate } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SpecSheetEditor } from "./SpecSheetEditor";

/**
 * `SpecSheetEditor` is fully controlled (`groups`/`onChange`), so the test
 * needs a small stateful wrapper to see the UI actually update after each
 * action — the component itself has no internal copy of `groups`. Saving is
 * `ProductEditor`'s job (its own unified save action); this component is
 * presentation-only, so no `ToastProvider` is needed here either.
 */
function Harness({ templates = [] }: { templates?: SpecTemplate[] }) {
  const [groups, setGroups] = useState<SpecGroup[]>([]);
  return <SpecSheetEditor groups={groups} onChange={setGroups} templates={templates} />;
}

function addGroupViaUi(title: string): void {
  fireEvent.change(screen.getByLabelText("Nuevo apartado"), { target: { value: title } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar apartado" }));
}

/**
 * The collapsed accordion bar for each apartado (M10.6.1) — always in the
 * DOM regardless of open/closed state, unlike the "Título del apartado"
 * input, which only renders while that one apartado is expanded. Matched by
 * "N especificaci..." rather than a bare "especificaci..." substring so it
 * doesn't also catch the "Agregar especificación" button.
 */
function accordionBars(): HTMLElement[] {
  return screen.getAllByRole("button", { name: /\d+ especificaci/ });
}

describe("SpecSheetEditor — the four required operations", () => {
  it("adds a group", () => {
    render(<Harness />);
    addGroupViaUi("Transmisión");

    expect(screen.getByDisplayValue("Transmisión")).toBeInTheDocument();
  });

  it("renames a group", () => {
    render(<Harness />);
    addGroupViaUi("Transmision"); // typo, to be fixed

    fireEvent.change(screen.getByDisplayValue("Transmision"), { target: { value: "Transmisión" } });

    expect(screen.getByDisplayValue("Transmisión")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Transmision")).not.toBeInTheDocument();
  });

  it("reorders groups by dragging the handle (keyboard fallback: Arrow key)", () => {
    render(<Harness />);
    addGroupViaUi("Cuadro");
    addGroupViaUi("Frenos");

    // "Cuadro" is first; move it down past "Frenos" via its drag handle's
    // Arrow-key fallback — `useDragReorder`'s accessible path, since a real
    // pointer drag isn't something `fireEvent` can simulate meaningfully.
    fireEvent.keyDown(screen.getByRole("button", { name: "Reordenar el apartado Cuadro" }), { key: "ArrowDown" });

    expect(accordionBars().map((bar) => bar.textContent)).toEqual([expect.stringContaining("Frenos"), expect.stringContaining("Cuadro")]);
  });

  it("deletes a group", () => {
    render(<Harness />);
    addGroupViaUi("Cuadro");
    addGroupViaUi("Frenos");

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar apartado" })[0] as HTMLElement);

    expect(accordionBars().map((bar) => bar.textContent)).toEqual([expect.stringContaining("Frenos")]);
  });

  it("adds, renames, reorders and deletes fields within a group", () => {
    render(<Harness />);
    addGroupViaUi("Transmisión");

    fireEvent.click(screen.getByRole("button", { name: "Agregar especificación" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar especificación" }));

    const [firstLabel, secondLabel] = screen.getAllByLabelText("Etiqueta") as HTMLInputElement[];
    fireEvent.change(firstLabel as HTMLInputElement, { target: { value: "Cassette" } });
    fireEvent.change(secondLabel as HTMLInputElement, { target: { value: "Cadena" } });

    // Same accessible Arrow-key fallback as the group-level handle above.
    fireEvent.keyDown(screen.getByRole("button", { name: "Reordenar la especificación Cassette" }), { key: "ArrowDown" });
    let labels = screen.getAllByLabelText("Etiqueta") as HTMLInputElement[];
    expect(labels.map((input) => input.value)).toEqual(["Cadena", "Cassette"]);

    // "Eliminar especificación", not the old bare "Eliminar": next to "Eliminar apartado"
    // in the same row, the unqualified label told a screen reader nothing.
    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar especificación" })[0] as HTMLElement);
    labels = screen.getAllByLabelText("Etiqueta") as HTMLInputElement[];
    expect(labels.map((input) => input.value)).toEqual(["Cassette"]);
  });
});

describe("SpecSheetEditor — applying a template (M10.3)", () => {
  it("prefills a new group's title and labels, with empty values", () => {
    const templates: SpecTemplate[] = [
      {
        id: "tpl-1",
        title: "Geometría",
        fields: [
          { label: "Talla", order: 0, isFilterable: false },
          { label: "Stack", order: 1, isFilterable: false },
        ],
        source: "manual",
        order: 0,
        isActive: true,
      },
    ];
    render(<Harness templates={templates} />);

    fireEvent.change(screen.getByLabelText("Aplicar plantilla"), { target: { value: "tpl-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar apartado desde plantilla" }));

    expect(screen.getByDisplayValue("Geometría")).toBeInTheDocument();
    const labels = screen.getAllByLabelText("Etiqueta") as HTMLInputElement[];
    expect(labels.map((input) => input.value)).toEqual(["Talla", "Stack"]);
    const values = screen.getAllByLabelText("Valor") as HTMLInputElement[];
    expect(values.every((input) => input.value === "")).toBe(true);
  });
});
