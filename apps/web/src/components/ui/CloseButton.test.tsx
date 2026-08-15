import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CloseButton } from "./CloseButton";

describe("CloseButton", () => {
  it('names itself "Cerrar" by default and takes a more specific label when the context needs one', () => {
    const { rerender } = render(<CloseButton />);
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();

    rerender(<CloseButton aria-label="Cerrar notificación" />);
    expect(screen.getByRole("button", { name: "Cerrar notificación" })).toBeInTheDocument();
  });

  it("is always bare — a dismiss never outweighs the content it closes", () => {
    render(<CloseButton />);
    const button = screen.getByRole("button", { name: "Cerrar" });
    expect(button).toHaveClass("bg-transparent");
    expect(button).toHaveClass("hover:bg-surface");
    expect(button).not.toHaveClass("border-negro");
  });

  it("draws the Phosphor X, not one of the three literal × glyphs it replaced", () => {
    render(<CloseButton />);
    const button = screen.getByRole("button", { name: "Cerrar" });
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).not.toHaveTextContent("×");
  });

  it("forwards the click handler", async () => {
    const onClick = vi.fn();
    render(<CloseButton onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
