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
  fireEvent.change(screen.getByLabelText("Nuevo grupo"), { target: { value: title } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar grupo" }));
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

  it("reorders groups with the ↑/↓ buttons", () => {
    render(<Harness />);
    addGroupViaUi("Cuadro");
    addGroupViaUi("Frenos");

    // "Cuadro" is first; move it down past "Frenos".
    fireEvent.click(screen.getAllByRole("button", { name: "Bajar grupo" })[0] as HTMLElement);

    const titleInputs = screen.getAllByLabelText("Título del grupo") as HTMLInputElement[];
    expect(titleInputs.map((input) => input.value)).toEqual(["Frenos", "Cuadro"]);
  });

  it("deletes a group", () => {
    render(<Harness />);
    addGroupViaUi("Cuadro");
    addGroupViaUi("Frenos");

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar grupo" })[0] as HTMLElement);

    expect(screen.queryByDisplayValue("Cuadro")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Frenos")).toBeInTheDocument();
  });

  it("adds, renames, reorders and deletes fields within a group", () => {
    render(<Harness />);
    addGroupViaUi("Transmisión");

    fireEvent.click(screen.getByRole("button", { name: "Agregar campo" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar campo" }));

    const [firstLabel, secondLabel] = screen.getAllByLabelText("Etiqueta") as HTMLInputElement[];
    fireEvent.change(firstLabel as HTMLInputElement, { target: { value: "Cassette" } });
    fireEvent.change(secondLabel as HTMLInputElement, { target: { value: "Cadena" } });

    fireEvent.click(screen.getAllByRole("button", { name: "Bajar campo" })[0] as HTMLElement);
    let labels = screen.getAllByLabelText("Etiqueta") as HTMLInputElement[];
    expect(labels.map((input) => input.value)).toEqual(["Cadena", "Cassette"]);

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0] as HTMLElement);
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
        fields: [{ label: "Talla", order: 0 }, { label: "Stack", order: 1 }],
        source: "manual",
        order: 0,
        isActive: true,
      },
    ];
    render(<Harness templates={templates} />);

    fireEvent.change(screen.getByLabelText("Aplicar plantilla"), { target: { value: "tpl-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar grupo desde plantilla" }));

    expect(screen.getByDisplayValue("Geometría")).toBeInTheDocument();
    const labels = screen.getAllByLabelText("Etiqueta") as HTMLInputElement[];
    expect(labels.map((input) => input.value)).toEqual(["Talla", "Stack"]);
    const values = screen.getAllByLabelText("Valor") as HTMLInputElement[];
    expect(values.every((input) => input.value === "")).toBe(true);
  });
});
