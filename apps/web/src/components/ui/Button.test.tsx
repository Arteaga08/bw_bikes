import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its children and defaults to the primary variant", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveClass("bg-dorado");
  });

  it("loading state disables the control and preserves its sizing classes — no layout shift", () => {
    render(<Button loading>Guardar</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("h-11");
    expect(button).toHaveClass("px-lg");
  });

  it("disabled state never changes the control's size (DESIGN_SYSTEM.md §4)", () => {
    render(<Button disabled>Guardar</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveClass("h-11");
    expect(button).toHaveClass("px-lg");
  });

  it("applies the right classes for each of the four variants", () => {
    const { rerender } = render(<Button variant="secondary">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-negro");

    rerender(<Button variant="ghost">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-negro");

    rerender(<Button variant="text">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-b");
  });
});
