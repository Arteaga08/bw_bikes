import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogHero } from "./CatalogHero";

describe("CatalogHero", () => {
  it("renders the eyebrow, the title and exactly one rhino mark", () => {
    const { container } = render(
      <CatalogHero
        image={{ url: "https://res.cloudinary.com/test/bikes.jpg", alt: "Bicicletas" }}
        eyebrow="Catálogo"
        title="Bicicletas"
      />,
    );

    expect(screen.getByText("Catálogo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bicicletas" })).toBeInTheDocument();

    // Exactly one rhino: this is the catalog page's second and last budgeted
    // appearance (`DESIGN_SYSTEM.md` §5.1) — the footer's is the first, and
    // nothing else on the page may add a third.
    const rhinos = container.querySelectorAll('img[src="/brand/rhino-dorado.svg"]');
    expect(rhinos).toHaveLength(1);
  });
});
