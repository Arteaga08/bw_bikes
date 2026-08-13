import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxOption } from "./Combobox";

const OPTIONS: ComboboxOption[] = [
  { id: "ruta", label: "Ruta" },
  { id: "ruta-endurance", label: "Ruta › Endurance" },
  { id: "mtb", label: "Montaña" },
  { id: "mtb-trail", label: "Montaña › Trail" },
];

function Harness({ initialValue = "", onChange }: { initialValue?: string; onChange?: (id: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return (
    <Combobox
      label="Categoría"
      value={value}
      onChange={(id) => {
        setValue(id);
        onChange?.(id);
      }}
      options={OPTIONS}
    />
  );
}

describe("Combobox", () => {
  it("shows the selected option's label, not its id", () => {
    render(<Harness initialValue="ruta-endurance" />);
    expect(screen.getByLabelText("Categoría")).toHaveValue("Ruta › Endurance");
  });

  it("filters the list as the admin types", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Categoría");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "trail" } });

    expect(screen.getByRole("option", { name: "Montaña › Trail" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Ruta" })).not.toBeInTheDocument();
  });

  it("selects an option on click and closes the list", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Categoría");
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("option", { name: "Montaña › Trail" }));

    expect(onChange).toHaveBeenCalledWith("mtb-trail");
    expect(input).toHaveValue("Montaña › Trail");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("focus lands on the first option, and Enter selects it", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Categoría");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("ruta");
  });

  it("ArrowDown moves to the next option before Enter selects it", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Categoría");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("ruta-endurance");
  });

  it("reverts unconfirmed typed text on Escape", () => {
    render(<Harness initialValue="ruta" />);
    const input = screen.getByLabelText("Categoría");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "algo que no existe" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveValue("Ruta");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("reverts unconfirmed typed text when focus moves outside", () => {
    render(
      <>
        <Harness initialValue="mtb" />
        <button type="button">Afuera</button>
      </>,
    );
    const input = screen.getByLabelText("Categoría");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "sin seleccionar" } });
    fireEvent.mouseDown(screen.getByRole("button", { name: "Afuera" }));

    expect(input).toHaveValue("Montaña");
  });
});
