import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpPopover } from "./HelpPopover";

describe("HelpPopover", () => {
  it("renders nothing open until the trigger is clicked", () => {
    render(
      <HelpPopover label="Descripción corta">
        <p>Aparece en las tarjetas de listado.</p>
      </HelpPopover>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a dialog titled after the field, showing the passed content", () => {
    render(
      <HelpPopover label="Descripción corta">
        <p>Aparece en las tarjetas de listado.</p>
      </HelpPopover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ayuda: Descripción corta" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Descripción corta");
    expect(screen.getByText("Aparece en las tarjetas de listado.")).toBeInTheDocument();
  });

  it("traps focus inside the dialog and returns it to the trigger on Escape", () => {
    render(
      <HelpPopover label="Descripción corta">
        <p>Aparece en las tarjetas de listado.</p>
      </HelpPopover>,
    );

    const trigger = screen.getByRole("button", { name: "Ayuda: Descripción corta" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(trigger);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
