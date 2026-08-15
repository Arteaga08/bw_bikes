import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonLink } from "./ButtonLink";

describe("ButtonLink", () => {
  it("renders a single <a>, never a <button> nested inside one", () => {
    render(<ButtonLink href="/admin/catalogo/bicicletas/nueva">Nueva bicicleta</ButtonLink>);

    const link = screen.getByRole("link", { name: "Nueva bicicleta" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/admin/catalogo/bicicletas/nueva");
    expect(link.querySelector("button")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shares Button's class matrix, so a link CTA is pixel-identical to the button one", () => {
    const { rerender } = render(<ButtonLink href="/x">Comprar</ButtonLink>);
    let link = screen.getByRole("link");
    expect(link).toHaveClass("bg-dorado");
    expect(link).toHaveClass("h-11");
    expect(link).toHaveClass("px-lg");

    rerender(
      <ButtonLink href="/x" variant="secondary" size="sm">
        Editar
      </ButtonLink>,
    );
    link = screen.getByRole("link");
    expect(link).toHaveClass("bg-negro");
    expect(link).toHaveClass("h-9");
  });

  it("supports the text variant with its grown underline — the pattern ManageBadgesLink hand-copied", () => {
    render(
      <ButtonLink href="/admin/catalogo/badges" variant="text">
        Administrar badges
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Administrar badges" });
    const underline = link.querySelector("span[aria-hidden='true']");
    expect(underline).toHaveClass("group-hover:scale-x-100");
    expect(underline).toHaveClass("bg-dorado");
  });

  it("hides icon slots from assistive tech so the accessible name is the label alone", () => {
    render(
      <ButtonLink href="/x" iconLeft={<svg data-testid="glyph" />}>
        Ir a pagar
      </ButtonLink>,
    );
    expect(screen.getByRole("link", { name: "Ir a pagar" })).toBeInTheDocument();
    expect(screen.getByTestId("glyph").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});
