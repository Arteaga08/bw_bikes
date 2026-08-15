import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { MAX_SPEC_FIELDS_PER_GROUP } from "@/lib/catalog/spec-groups";
import { SpecTemplateFormModal } from "./SpecTemplateFormModal";

/**
 * Only the "Etiquetas" row editing is covered here — add, reorder, delete,
 * the `MAX_SPEC_FIELDS_PER_GROUP` cap. None of that reaches
 * `adminSpecTemplatesApi`, so nothing needs mocking: the network call only
 * happens on "Guardar", which these tests never click. Pointer-drag
 * reordering isn't exercised here either — jsdom has no real layout to
 * measure row midpoints against, so `useDragReorder`'s pointer path is a
 * manual check (see the redesign's verification steps); its Arrow-key
 * fallback is what's covered below.
 */
function renderModal() {
  render(
    <ToastProvider>
      <SpecTemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />
    </ToastProvider>,
  );
}

function addFieldViaUi(label: string): void {
  fireEvent.change(screen.getByLabelText("Nueva etiqueta"), { target: { value: label } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar etiqueta" }));
}

describe("SpecTemplateFormModal — etiquetas", () => {
  it("adds a field with the button", () => {
    renderModal();
    addFieldViaUi("Cuadro");

    expect(screen.getByDisplayValue("Cuadro")).toBeInTheDocument();
  });

  it("adds a field with Enter", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Nueva etiqueta"), { target: { value: "Suspensión" } });
    fireEvent.keyDown(screen.getByLabelText("Nueva etiqueta"), { key: "Enter" });

    expect(screen.getByDisplayValue("Suspensión")).toBeInTheDocument();
    // The input clears after a successful add, ready for the next label.
    expect(screen.getByLabelText("Nueva etiqueta")).toHaveValue("");
  });

  it("reorders fields with the drag handle's Arrow-key fallback", () => {
    renderModal();
    addFieldViaUi("Cuadro");
    addFieldViaUi("Frenos");

    // "Cuadro" is first; ArrowDown on its handle should move it past "Frenos".
    fireEvent.keyDown(screen.getAllByRole("button", { name: "Reordenar etiqueta" })[0] as HTMLElement, { key: "ArrowDown" });

    const labels = screen.getAllByLabelText("Etiqueta") as HTMLInputElement[];
    expect(labels.map((input) => input.value)).toEqual(["Frenos", "Cuadro"]);
  });

  it("deletes a field", () => {
    renderModal();
    addFieldViaUi("Cuadro");
    addFieldViaUi("Frenos");

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar etiqueta" })[0] as HTMLElement);

    expect(screen.queryByDisplayValue("Cuadro")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Frenos")).toBeInTheDocument();
  });

  it("disables 'Agregar etiqueta' once MAX_SPEC_FIELDS_PER_GROUP is reached", () => {
    renderModal();
    for (let index = 0; index < MAX_SPEC_FIELDS_PER_GROUP; index += 1) {
      addFieldViaUi(`Campo ${index}`);
    }

    expect(screen.getByRole("button", { name: "Agregar etiqueta" })).toBeDisabled();
  });
});
