import type { PublicAccessory, PublicBike } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductOverview } from "./ProductOverview";

function makeAccessory(overrides: Partial<PublicAccessory> = {}): PublicAccessory {
  return {
    id: "acc-1",
    name: "Bontrager Casco Starvos",
    slug: "bontrager-casco-starvos",
    brand: { id: "brand-2", name: "Bontrager", slug: "bontrager", order: 0 },
    category: { id: "cat-2", name: "Cascos", slug: "cascos", parent: null, order: 0, usesSizes: true },
    badges: [],
    description: "Casco ligero con ventilación amplia.",
    price: 180000,
    currency: "MXN",
    variants: [],
    specGroups: [],
    gallery: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeBike(overrides: Partial<PublicBike> = {}): PublicBike {
  return {
    ...makeAccessory({
      id: "bike-1",
      name: "Trek Verve+ 2",
      slug: "trek-verve-plus-2",
      brand: { id: "brand-1", name: "Trek", slug: "trek", order: 0 },
      category: { id: "cat-1", name: "Urbana", slug: "urbana", parent: null, order: 0, usesSizes: true },
      description: "Motor Bosch de asistencia al pedaleo y batería integrada en el cuadro.",
      price: 2500000,
    }),
    shortDescription: "Una híbrida eléctrica para la ciudad.",
    summary: [
      { label: "Uso", value: "Ciudad", order: 0 },
      { label: "Peso", value: "22 kg", order: 1 },
    ],
    relatedAccessories: [],
    ...overrides,
  };
}

describe("ProductOverview", () => {
  it("shows the brand-stripped title and the full description for a bike", () => {
    render(<ProductOverview product={makeBike()} />);

    expect(screen.getByRole("heading", { name: "Verve+ 2", level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Motor Bosch/)).toBeInTheDocument();
  });

  it("does not repeat `shortDescription` — the rail's teaser already carries that string", () => {
    render(<ProductOverview product={makeBike()} />);

    expect(screen.queryByText("Una híbrida eléctrica para la ciudad.")).not.toBeInTheDocument();
  });

  it("renders the 'En pocas palabras' card when the bike has a summary", () => {
    render(<ProductOverview product={makeBike()} />);

    expect(screen.getByRole("heading", { name: "En pocas palabras" })).toBeInTheDocument();
    expect(screen.getByText("Ciudad")).toBeInTheDocument();
  });

  it("drops the card for a bike whose summary is empty, and keeps the description", () => {
    render(<ProductOverview product={makeBike({ summary: [] })} />);

    expect(screen.queryByRole("heading", { name: "En pocas palabras" })).not.toBeInTheDocument();
    expect(screen.getByText(/Motor Bosch/)).toBeInTheDocument();
  });

  it("shows only title and description for an accessory — it has no shortDescription or summary", () => {
    render(<ProductOverview product={makeAccessory()} />);

    expect(screen.getByRole("heading", { name: "Casco Starvos", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Casco ligero con ventilación amplia.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "En pocas palabras" })).not.toBeInTheDocument();
  });

  it("carries the anchor `ProductDescriptionTeaser`'s 'Leer más' points at", () => {
    const { container } = render(<ProductOverview product={makeBike()} />);

    expect(container.querySelector("#descripcion")).toBeInTheDocument();
  });
});
