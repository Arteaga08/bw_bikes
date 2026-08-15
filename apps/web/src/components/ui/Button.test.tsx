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

  it("applies the right classes for each of the five variants", () => {
    const { rerender } = render(<Button variant="secondary">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-negro");

    rerender(<Button variant="ghost">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-negro");

    rerender(<Button variant="bare">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-transparent");
    expect(screen.getByRole("button")).not.toHaveClass("border-negro");

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

  it("bare rests with no box and lifts to a white body on hover, like the inputs beside it", () => {
    render(
      <Button variant="bare" size="icon" aria-label="Subir grupo">
        <span />
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Subir grupo" });
    expect(button).toHaveClass("bg-transparent");
    expect(button).toHaveClass("text-grafito");
    expect(button).toHaveClass("hover:bg-surface");
    expect(button).toHaveClass("hover:border-borde");
    expect(button).toHaveClass("active:bg-borde");
    expect(button).toHaveClass("disabled:text-negro-disabled-text");
    expect(button).toHaveClass("focus-visible:outline-negro");
  });

  it("marks a neutral bare button so the in-group hover rule in globals.css can find it", () => {
    const { rerender } = render(
      <Button variant="bare" size="icon" aria-label="Subir">
        <span />
      </Button>,
    );
    expect(screen.getByRole("button")).toHaveClass("is-bare-neutral");

    // Danger keeps its own red hover inside a group, so it must not match.
    rerender(
      <Button variant="bare" size="icon" tone="danger-strong" aria-label="Eliminar">
        <span />
      </Button>,
    );
    expect(screen.getByRole("button")).not.toHaveClass("is-bare-neutral");

    rerender(<Button variant="ghost">Editar</Button>);
    expect(screen.getByRole("button")).not.toHaveClass("is-bare-neutral");
  });

  it("bare honors the danger tiers, so a row's delete reads red without a border", () => {
    render(
      <Button variant="bare" size="icon" tone="danger-strong" aria-label="Eliminar campo">
        <span />
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Eliminar campo" });
    expect(button).toHaveClass("hover:bg-estado-error");
    expect(button).toHaveClass("hover:text-blanco");
    expect(button).not.toHaveClass("hover:bg-borde");
  });

  it("inverse tone swaps the palette for controls sitting on the overlay surface", () => {
    const { rerender } = render(
      <Button variant="text" tone="inverse">
        Cerrar sesión
      </Button>,
    );
    let button = screen.getByRole("button");
    expect(button).toHaveClass("text-blanco/70");
    expect(button).toHaveClass("hover:text-dorado");
    expect(button).toHaveClass("focus-visible:outline-dorado");

    rerender(
      <Button variant="bare" tone="inverse" size="icon" aria-label="Cerrar">
        <span />
      </Button>,
    );
    button = screen.getByRole("button", { name: "Cerrar" });
    expect(button).toHaveClass("text-blanco/70");
    expect(button).not.toHaveClass("text-grafito");
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

  it("icon-lg keeps the square shape at the full 44px touch target for standalone chrome", () => {
    render(<Button variant="bare" size="icon-lg" aria-label="Abrir menú" iconLeft={<svg />} />);
    const button = screen.getByRole("button", { name: "Abrir menú" });
    expect(button).toHaveClass("h-11");
    expect(button).toHaveClass("w-11");
    expect(button).toHaveClass("p-0");
  });

  it("success swaps the label, shows a check, and blocks the control for the confirmation window", () => {
    render(
      <Button variant="secondary" success successLabel="Agregado">
        Agregar al carrito
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Agregado" });
    expect(button).toBeDisabled();
    expect(button).toHaveClass("bg-estado-exito-soft");
    expect(button).toHaveClass("text-estado-exito");
    // The variant's own colors are replaced, not layered — two bg-* would fight.
    expect(button).not.toHaveClass("bg-negro");
    expect(button.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Agregar al carrito" })).not.toBeInTheDocument();
  });

  it("success falls back to the original label when no successLabel is given", () => {
    render(<Button success>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("icon slots are hidden from assistive tech, so the accessible name comes from the label alone", () => {
    render(
      <Button iconLeft={<svg data-testid="cart" />} iconRight={<svg data-testid="arrow" />}>
        Agregar al carrito
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Agregar al carrito" });
    expect(button.querySelectorAll("span[aria-hidden='true']")).toHaveLength(2);
    expect(screen.getByTestId("cart").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("arrow").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});
