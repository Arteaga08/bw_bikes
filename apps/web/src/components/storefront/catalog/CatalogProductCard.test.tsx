import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicColorSwatch, PublicProductSummary } from "@/lib/api/public-catalog";
import { CatalogProductCard } from "./CatalogProductCard";

function makeProduct(overrides: Partial<PublicProductSummary> = {}): PublicProductSummary {
  return {
    id: "p1",
    slug: "tarmac-sl9",
    kind: "bike",
    name: "Tarmac SL9",
    brand: { id: "b1", name: "Specialized", slug: "specialized", order: 0 },
    price: 9_500_000,
    badges: [],
    colors: [],
    gallery: [{ publicId: "img-1", url: "https://res.cloudinary.com/test/a.jpg", width: 800, height: 600, order: 0 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const emptySwatchIndex = new Map<string, PublicColorSwatch>();

describe("CatalogProductCard", () => {
  it("links to the product's PDP", () => {
    render(<CatalogProductCard product={makeProduct()} colorSwatchIndex={emptySwatchIndex} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/bicicletas/producto/tarmac-sl9");
  });

  it("renders the rounded discount percentage and strikes through the compare-at price", () => {
    render(
      <CatalogProductCard
        product={makeProduct({ price: 175_480_00, compareAtPrice: 219_350_00 })}
        colorSwatchIndex={emptySwatchIndex}
      />,
    );
    // (219350 - 175480) / 219350 = 19.99...% → rounds to 20.
    expect(screen.getByText("-20%")).toBeInTheDocument();
    expect(screen.getByText("$219,350.00 MXN")).toBeInTheDocument();
  });

  it("shows the currency next to the price", () => {
    render(<CatalogProductCard product={makeProduct()} colorSwatchIndex={emptySwatchIndex} />);
    expect(screen.getByText("MXN")).toBeInTheDocument();
  });

  it("strips a leading brand name from the product name, since the eyebrow already shows it", () => {
    render(
      <CatalogProductCard
        product={makeProduct({ name: "Trek Verve+ 2", brand: { id: "b2", name: "Trek", slug: "trek", order: 0 } })}
        colorSwatchIndex={emptySwatchIndex}
      />,
    );
    expect(screen.getByText("Verve+ 2")).toBeInTheDocument();
    expect(screen.queryByText("Trek Verve+ 2")).not.toBeInTheDocument();
  });

  it("leaves the name untouched when it only starts similarly to the brand", () => {
    render(
      <CatalogProductCard
        product={makeProduct({ name: "Trekking X", brand: { id: "b2", name: "Trek", slug: "trek", order: 0 } })}
        colorSwatchIndex={emptySwatchIndex}
      />,
    );
    expect(screen.getByText("Trekking X")).toBeInTheDocument();
  });

  it("renders the rhino mark once per card", () => {
    const { container } = render(<CatalogProductCard product={makeProduct()} colorSwatchIndex={emptySwatchIndex} />);
    expect(container.querySelectorAll('img[src="/brand/rhino-dorado.svg"]')).toHaveLength(1);
  });

  it("renders no discount badge when there is no compareAtPrice", () => {
    render(<CatalogProductCard product={makeProduct()} colorSwatchIndex={emptySwatchIndex} />);
    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument();
  });

  it("renders no discount badge when compareAtPrice does not exceed the price", () => {
    render(
      <CatalogProductCard
        product={makeProduct({ price: 100_00, compareAtPrice: 100_00 })}
        colorSwatchIndex={emptySwatchIndex}
      />,
    );
    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument();
  });

  it("mounts a second, slide-to image only when the gallery has one", () => {
    // Excludes the card's own rhino mark — a fixed, single image unrelated
    // to gallery size — so this only counts product photos.
    const photoImages = (container: HTMLElement) =>
      container.querySelectorAll('img:not([src="/brand/rhino-dorado.svg"])');

    const { container: single } = render(
      <CatalogProductCard product={makeProduct()} colorSwatchIndex={emptySwatchIndex} />,
    );
    expect(photoImages(single)).toHaveLength(1);

    const { container: double } = render(
      <CatalogProductCard
        product={makeProduct({
          gallery: [
            { publicId: "a", url: "https://res.cloudinary.com/test/a.jpg", width: 800, height: 600, order: 0 },
            { publicId: "b", url: "https://res.cloudinary.com/test/b.jpg", width: 800, height: 600, order: 1 },
          ],
        })}
        colorSwatchIndex={emptySwatchIndex}
      />,
    );
    expect(photoImages(double)).toHaveLength(2);
  });

  it("caps colors at five swatches and folds the rest into a +N", () => {
    render(
      <CatalogProductCard
        product={makeProduct({ colors: ["Rojo", "Negro", "Blanco", "Azul", "Verde", "Gris", "Dorado"] })}
        colorSwatchIndex={emptySwatchIndex}
      />,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("Colores: Rojo, Negro, Blanco, Azul, Verde, Gris, Dorado")).toBeInTheDocument();
  });

  it("renders a color with no matching template without throwing", () => {
    expect(() =>
      render(
        <CatalogProductCard
          product={makeProduct({ colors: ["Edición limitada"] })}
          colorSwatchIndex={emptySwatchIndex}
        />,
      ),
    ).not.toThrow();
  });

  it("renders up to two curated badges from the backend", () => {
    render(
      <CatalogProductCard
        product={makeProduct({
          badges: [
            { id: "bg1", label: "Nuevo", slug: "nuevo", variant: "accent", order: 0 },
            { id: "bg2", label: "E-Bike", slug: "e-bike", variant: "accent", order: 1 },
            { id: "bg3", label: "Top ventas", slug: "top-ventas", variant: "neutral", order: 2 },
          ],
        })}
        colorSwatchIndex={emptySwatchIndex}
      />,
    );
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
    expect(screen.getByText("E-Bike")).toBeInTheDocument();
    expect(screen.queryByText("Top ventas")).not.toBeInTheDocument();
  });

  it("renders nothing when the product has no gallery", () => {
    const { container } = render(
      <CatalogProductCard product={makeProduct({ gallery: [] })} colorSwatchIndex={emptySwatchIndex} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
