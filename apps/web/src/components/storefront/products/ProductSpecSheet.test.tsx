import type { PublicAccessory, PublicBike, SpecGroup } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductSpecSheet } from "./ProductSpecSheet";

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
    summary: [],
    relatedAccessories: [],
    ...overrides,
  };
}

const SPEC_GROUPS: SpecGroup[] = [
  {
    title: "Cuadro",
    order: 0,
    visible: true,
    fields: [{ label: "Material", value: "Aluminio Alpha Gold", order: 0, visible: true }],
  },
  {
    title: "Transmisión",
    order: 1,
    visible: true,
    fields: [{ label: "Grupo", value: "Shimano Deore", order: 0, visible: true }],
  },
];

describe("ProductSpecSheet", () => {
  it("renders a row per available block: specs and geometry", () => {
    render(
      <ProductSpecSheet
        product={makeBike({
          specGroups: SPEC_GROUPS,
          geometryImage: { publicId: "geo-1", url: "https://example.com/geo.png", width: 1200, height: 800 },
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Especificaciones técnicas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Geometría" })).toBeInTheDocument();
  });

  it("shows each group's title and its label/value pairs", () => {
    render(<ProductSpecSheet product={makeBike({ specGroups: SPEC_GROUPS })} />);

    expect(screen.getByRole("heading", { name: "Cuadro", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Material")).toBeInTheDocument();
    expect(screen.getByText("Aluminio Alpha Gold")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Transmisión", level: 3 })).toBeInTheDocument();
  });

  it("omits the specs row when there are no spec groups", () => {
    render(<ProductSpecSheet product={makeBike({ specGroups: [] })} />);

    expect(screen.queryByRole("button", { name: "Especificaciones técnicas" })).not.toBeInTheDocument();
  });

  it("omits the geometry row when the bike has no geometry image", () => {
    render(<ProductSpecSheet product={makeBike({ specGroups: SPEC_GROUPS, geometryImage: undefined })} />);

    expect(screen.queryByRole("button", { name: "Geometría" })).not.toBeInTheDocument();
  });

  it("never shows a geometry row for an accessory — geometryImage isn't part of its shape", () => {
    render(<ProductSpecSheet product={makeAccessory({ specGroups: SPEC_GROUPS })} />);

    expect(screen.queryByRole("button", { name: "Geometría" })).not.toBeInTheDocument();
  });

  it("renders nothing when there is neither a spec sheet nor a geometry image", () => {
    const { container } = render(<ProductSpecSheet product={makeAccessory({ specGroups: [] })} />);

    expect(container).toBeEmptyDOMElement();
  });
});
