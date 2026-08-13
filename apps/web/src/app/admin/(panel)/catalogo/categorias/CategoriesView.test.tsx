import type { AdminCategory } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { CategoriesView } from "./CategoriesView";

function makeCategory(overrides: Partial<AdminCategory> = {}): AdminCategory {
  return {
    id: "cat-1",
    name: "Montaña",
    slug: "montana",
    parent: null,
    order: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTree(): CategoryTreeNode[] {
  return [
    {
      ...makeCategory({ id: "root-1", name: "Montaña" }),
      children: [
        makeCategory({ id: "child-1", name: "Down Country", parent: "root-1", order: 0 }),
        makeCategory({ id: "child-2", name: "Enduro", parent: "root-1", order: 1 }),
      ],
    },
    { ...makeCategory({ id: "root-2", name: "Ruta", order: 1 }), children: [] },
  ];
}

describe("CategoriesView", () => {
  it("renders each root's children indented right below it, in tree order", () => {
    render(
      <ToastProvider>
        <CategoriesView kind="bike" initialTree={makeTree()} />
      </ToastProvider>,
    );

    // Header row + one row per category (2 roots + 2 children of the first root).
    const rows = screen.getAllByRole("row");
    const rowTexts = rows.slice(1).map((row) => row.textContent ?? "");
    expect(rowTexts[0]).toContain("Montaña");
    expect(rowTexts[1]).toContain("Down Country");
    expect(rowTexts[2]).toContain("Enduro");
    expect(rowTexts[3]).toContain("Ruta");
  });

  it("only offers \"Agregar subcategoría\" on root rows, never on children", () => {
    render(
      <ToastProvider>
        <CategoriesView kind="bike" initialTree={makeTree()} />
      </ToastProvider>,
    );

    // Two roots ("Montaña", "Ruta") each get one "Agregar subcategoría" — the
    // two children of "Montaña" don't, since a category is only two levels
    // deep and a child can't have its own subcategory.
    expect(screen.getAllByRole("button", { name: "Agregar subcategoría" })).toHaveLength(2);
  });

  it("shows the empty state instead of a bare table when there are no categories", () => {
    render(
      <ToastProvider>
        <CategoriesView kind="bike" initialTree={[]} />
      </ToastProvider>,
    );

    expect(screen.getByText("Sin categorías todavía.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
