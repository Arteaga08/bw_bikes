import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogFilterGroup } from "./CatalogFilterGroup";

describe("CatalogFilterGroup", () => {
  it("starts collapsed by default, with the panel inert", () => {
    render(
      <CatalogFilterGroup title="Marca">
        <p>Contenido</p>
      </CatalogFilterGroup>,
    );

    expect(screen.getByRole("button", { name: "Marca" })).toHaveAttribute("aria-expanded", "false");
    const panel = screen.getByText("Contenido").closest("[inert]");
    expect(panel).not.toBeNull();
  });

  it("starts expanded when defaultOpen is set", () => {
    render(
      <CatalogFilterGroup title="Categoría" defaultOpen>
        <p>Contenido</p>
      </CatalogFilterGroup>,
    );

    expect(screen.getByRole("button", { name: "Categoría" })).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles expanded state on click, removing inert once open", () => {
    render(
      <CatalogFilterGroup title="Talla">
        <p>Contenido</p>
      </CatalogFilterGroup>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Talla" }));

    expect(screen.getByRole("button", { name: "Talla" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Contenido").closest("[inert]")).toBeNull();
  });
});
