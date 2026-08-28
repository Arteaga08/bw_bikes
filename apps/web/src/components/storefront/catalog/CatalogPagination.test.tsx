import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogPagination } from "./CatalogPagination";

describe("CatalogPagination", () => {
  it("renders nothing for a single-page result", () => {
    const { container } = render(<CatalogPagination basePath="/bicicletas" page={1} pages={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no previous link on the first page", () => {
    render(<CatalogPagination basePath="/bicicletas" page={1} pages={3} />);
    expect(screen.queryByRole("link", { name: "Anterior" })).not.toBeInTheDocument();
    expect(screen.getByText("Anterior")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", "/bicicletas?page=2");
  });

  it("has no next link on the last page", () => {
    render(<CatalogPagination basePath="/bicicletas" page={3} pages={3} />);
    expect(screen.queryByRole("link", { name: "Siguiente" })).not.toBeInTheDocument();
    expect(screen.getByText("Siguiente")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute("href", "/bicicletas?page=2");
  });

  it("links both directions on a middle page", () => {
    render(<CatalogPagination basePath="/accesorios/cascos" page={2} pages={4} />);
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute("href", "/accesorios/cascos?page=1");
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", "/accesorios/cascos?page=3");
    expect(screen.getByText("Página 2 de 4")).toBeInTheDocument();
  });

  it("carries the active filters forward instead of dropping them on Anterior/Siguiente", () => {
    render(<CatalogPagination basePath="/bicicletas" page={2} pages={3} filterQuery="brand=specialized&size=M" />);
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/bicicletas?brand=specialized&size=M&page=1",
    );
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute(
      "href",
      "/bicicletas?brand=specialized&size=M&page=3",
    );
  });
});
