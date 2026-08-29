import type { ProductVariant } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductPrice } from "./ProductPrice";

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return { sku: "SKU-1", fulfillmentMode: "in_stock", isActive: true, ...overrides };
}

describe("ProductPrice", () => {
  it("shows the base price when no variant is selected", () => {
    render(<ProductPrice basePrice={2500000} />);
    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
  });

  it("shows the selected variant's own price when it overrides the base price", () => {
    render(<ProductPrice basePrice={2500000} selectedVariant={variant({ price: 2800000 })} />);
    expect(screen.getByText("$28,000.00")).toBeInTheDocument();
    expect(screen.queryByText("$25,000.00")).not.toBeInTheDocument();
  });

  it("falls back to the base price when the selected variant has no price override", () => {
    render(<ProductPrice basePrice={2500000} selectedVariant={variant()} />);
    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
  });

  it("shows a struck-through compareAtPrice above the displayed price", () => {
    render(<ProductPrice basePrice={2500000} compareAtPrice={3000000} />);
    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
    expect(screen.getByText(/\$30,000\.00 MXN/)).toBeInTheDocument();
  });

  it("hides compareAtPrice once it no longer exceeds the displayed (variant-overridden) price", () => {
    render(<ProductPrice basePrice={2500000} compareAtPrice={2600000} selectedVariant={variant({ price: 2800000 })} />);
    expect(screen.queryByText("Precio anterior:", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(/\$26,000\.00/)).not.toBeInTheDocument();
  });
});
