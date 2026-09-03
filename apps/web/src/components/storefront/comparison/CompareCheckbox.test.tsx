import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";
import type { PublicProductSummary } from "@/lib/api/public-catalog";
import { CompareCheckbox } from "./CompareCheckbox";
import { MAX_COMPARISON_ENTRIES, useComparison, type ComparisonEntry } from "./ComparisonProvider";
import { ComparisonProvider } from "./ComparisonProvider";

const brand = { id: "brand-1", name: "Canyon", slug: "canyon", order: 0 };

function bikeSummary(slug: string): PublicProductSummary {
  return {
    id: slug,
    slug,
    kind: "bike",
    name: `Bici ${slug}`,
    brand,
    price: 1_000_00,
    badges: [],
    colors: [],
    gallery: [{ publicId: `pub-${slug}`, url: `https://example.com/${slug}.jpg`, width: 800, height: 600, order: 0 }],
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function accessorySummary(slug: string): PublicProductSummary {
  return { ...bikeSummary(slug), kind: "accessory" };
}

/** A link wrapper, mirroring how `CatalogProductCard` mounts `CompareCheckbox` inside its own `<Link>` — proves the click never bubbles into navigation. */
function CardStub({ product, onNavigate }: { product: PublicProductSummary; onNavigate: () => void }) {
  return (
    <a href="#" onClick={onNavigate}>
      <CompareCheckbox product={product} />
    </a>
  );
}

/** Seeds the provider with a fixed selection for a test. `toggle` flips a slug on *and* off, so it has to run exactly once per entry — a `useRef` guard, not a bare call in the render body, which would add-then-immediately-remove-then-re-add forever. */
function Prefill({ entries }: { entries: ComparisonEntry[] }) {
  const { toggle } = useComparison();
  const appliedRef = useRef(false);
  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    for (const entry of entries) toggle(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- test scaffolding: `entries` is a fresh array identity per render by design, only `toggle` needs to be stable.
  }, [toggle]);
  return null;
}

describe("CompareCheckbox", () => {
  it("renders nothing for an accessory", () => {
    render(
      <ComparisonProvider>
        <CompareCheckbox product={accessorySummary("acc-1")} />
      </ComparisonProvider>,
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("toggles a bike on and off, and never navigates the surrounding link", async () => {
    const user = userEvent.setup();
    let navigated = false;

    render(
      <ComparisonProvider>
        <CardStub product={bikeSummary("bike-1")} onNavigate={() => (navigated = true)} />
      </ComparisonProvider>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Comparar Bici bike-1" });
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    await user.click(checkbox);
    expect(screen.getByRole("checkbox", { name: "Quitar Bici bike-1 de la comparación" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.click(screen.getByRole("checkbox", { name: "Quitar Bici bike-1 de la comparación" }));
    expect(screen.getByRole("checkbox", { name: "Comparar Bici bike-1" })).toHaveAttribute("aria-checked", "false");

    expect(navigated).toBe(false);
  });

  it("disables an unselected checkbox once the selection is full", () => {
    const entries: ComparisonEntry[] = Array.from({ length: MAX_COMPARISON_ENTRIES }, (_, index) => ({
      slug: `bike-${index}`,
      name: `Bici ${index}`,
      brandName: "Canyon",
      price: 1_000_00,
    }));

    render(
      <ComparisonProvider>
        <Prefill entries={entries} />
        <CompareCheckbox product={bikeSummary("bike-extra")} />
      </ComparisonProvider>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Comparar Bici bike-extra" });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveAttribute("title", "Ya elegiste 3 bicicletas");
  });

  it("keeps an already-selected checkbox enabled even when the selection is full, so it can still be removed", () => {
    const entries: ComparisonEntry[] = Array.from({ length: MAX_COMPARISON_ENTRIES }, (_, index) => ({
      slug: `bike-${index}`,
      name: `Bici ${index}`,
      brandName: "Canyon",
      price: 1_000_00,
    }));

    render(
      <ComparisonProvider>
        <Prefill entries={entries} />
        <CompareCheckbox product={bikeSummary("bike-0")} />
      </ComparisonProvider>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Quitar Bici bike-0 de la comparación" });
    expect(checkbox).not.toBeDisabled();
  });
});
