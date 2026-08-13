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

    // No static underline anymore — the hover-grown line is a separate
    // element, so `text` is identified by its own layout base instead.
    rerender(<Button variant="text">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("relative");
    expect(screen.getByRole("button")).not.toHaveClass("border-b");
  });

  it("text variant renders a hover underline that grows from the center, not a static one", () => {
    render(<Button variant="text">Administrar badges</Button>);
    const button = screen.getByRole("button", { name: "Administrar badges" });
    const underline = button.querySelector("span[aria-hidden='true']");
    expect(underline).not.toBeNull();
    expect(underline).toHaveClass("origin-center");
    expect(underline).toHaveClass("scale-x-0");
    expect(underline).toHaveClass("group-hover:scale-x-100");
    expect(underline).toHaveClass("bg-dorado");
  });

  it("ghost tone defaults to neutral (invert to solid negro on hover) and opts into danger tiers", () => {
    const { rerender } = render(<Button variant="ghost">Editar</Button>);
    let button = screen.getByRole("button");
    expect(button).toHaveClass("hover:bg-negro");

    rerender(
      <Button variant="ghost" tone="danger">
        Archivar
      </Button>,
    );
    button = screen.getByRole("button");
    expect(button).toHaveClass("hover:bg-estado-error-soft");
    expect(button).toHaveClass("active:bg-estado-error");

    rerender(
      <Button variant="ghost" tone="danger-strong">
        Eliminar
      </Button>,
    );
    button = screen.getByRole("button");
    expect(button).toHaveClass("hover:bg-estado-error");
    expect(button).not.toHaveClass("hover:bg-estado-error-soft");
  });

  it("defaults to the md size and lets a row action opt into sm", () => {
    const { rerender } = render(<Button>Guardar</Button>);
    let button = screen.getByRole("button");
    expect(button).toHaveClass("h-11");
    expect(button).toHaveClass("px-lg");

    rerender(<Button size="sm">Editar</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("h-9");
    expect(button).toHaveClass("px-md");
    expect(button).not.toHaveClass("h-11");
  });

  it("sizes an icon-only button square, with no horizontal padding", () => {
    render(
      <Button size="icon" aria-label="Eliminar">
        ×
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Eliminar" });
    expect(button).toHaveClass("h-9");
    expect(button).toHaveClass("w-9");
    expect(button).toHaveClass("p-0");
    expect(button).not.toHaveClass("px-lg");
    expect(button).not.toHaveClass("px-md");
  });
});
