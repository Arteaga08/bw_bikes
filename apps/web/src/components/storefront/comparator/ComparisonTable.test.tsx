import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ComparableBike } from "@/lib/api/public-catalog";
import { ComparisonTable } from "./ComparisonTable";

function makeBike(overrides: Partial<ComparableBike> = {}): ComparableBike {
  return {
    id: overrides.slug ?? "1",
    slug: "tarmac",
    name: "Tarmac SL7",
    brandName: "Specialized",
    price: 3_890_000,
    sizes: [],
    specGroups: [],
    ...overrides,
  };
}

describe("ComparisonTable", () => {
  it("renders one header column per bike, with its name, price and a PDP link", () => {
    render(
      <ComparisonTable
        bikes={[
          makeBike({ slug: "tarmac", name: "Tarmac SL7", price: 3_890_000 }),
          makeBike({ slug: "domane", name: "Domane SL6", brandName: "Trek", price: 3_200_000 }),
        ]}
      />,
    );

    expect(screen.getByText("Tarmac SL7")).toBeInTheDocument();
    expect(screen.getByText("Domane SL6")).toBeInTheDocument();
    // Appears twice by design — once in `ComparisonHeader`'s own price line, once again in the "Ficha general" → Precio row.
    expect(screen.getAllByText("$38,900.00")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Ver ficha" })).toHaveLength(2);
  });

  it("always shows the 'Ficha general' group with at least Precio", () => {
    render(<ComparisonTable bikes={[makeBike({ slug: "a" }), makeBike({ slug: "b" })]} />);
    expect(screen.getByRole("heading", { name: "Ficha general" })).toBeInTheDocument();
    expect(screen.getByText("Precio")).toBeInTheDocument();
  });

  it("shows Año del modelo, Precio anterior and Tallas disponibles only when at least one bike carries them", () => {
    render(
      <ComparisonTable
        bikes={[
          makeBike({ slug: "a", modelYear: 2026, compareAtPrice: 4_500_000, sizes: ["S", "M"] }),
          makeBike({ slug: "b" }),
        ]}
      />,
    );

    expect(screen.getByText("Año del modelo")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("Precio anterior")).toBeInTheDocument();
    expect(screen.getByText("Tallas disponibles")).toBeInTheDocument();
    expect(screen.getByText("S · M")).toBeInTheDocument();
  });

  it("omits Año del modelo, Precio anterior and Tallas disponibles when no bike carries any of them", () => {
    render(<ComparisonTable bikes={[makeBike({ slug: "a" }), makeBike({ slug: "b" })]} />);

    expect(screen.queryByText("Año del modelo")).not.toBeInTheDocument();
    expect(screen.queryByText("Precio anterior")).not.toBeInTheDocument();
    expect(screen.queryByText("Tallas disponibles")).not.toBeInTheDocument();
  });

  it("renders a spec-sheet group and a dash for the bike that doesn't declare that label", () => {
    render(
      <ComparisonTable
        bikes={[
          makeBike({
            slug: "a",
            specGroups: [{ title: "Transmisión", fields: [{ label: "Grupo", value: "Ultegra Di2" }] }],
          }),
          makeBike({ slug: "b", specGroups: [] }),
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Transmisión" })).toBeInTheDocument();
    expect(screen.getByText("Ultegra Di2")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders one column per bike for a comparison of three", () => {
    render(
      <ComparisonTable
        bikes={[
          makeBike({ slug: "a", name: "Bici A", price: 1_000_00 }),
          makeBike({ slug: "b", name: "Bici B", price: 2_000_00 }),
          makeBike({ slug: "c", name: "Bici C", price: 3_000_00 }),
        ]}
      />,
    );

    expect(screen.getByText("Bici A")).toBeInTheDocument();
    expect(screen.getByText("Bici B")).toBeInTheDocument();
    expect(screen.getByText("Bici C")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Ver ficha" })).toHaveLength(3);
  });
});
