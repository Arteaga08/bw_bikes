import type { PublicCart } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CartSummary } from "./CartSummary";

const BASE_CART: PublicCart = {
  id: "cart-1",
  lines: [],
  subtotalCents: 2_500_000,
  discountCents: 0,
  taxCents: 344_828,
  shippingCents: 0,
  totalCents: 2_500_000,
  currency: "MXN",
  captureMethod: "automatic",
  hasBlockingLines: false,
  updatedAt: new Date().toISOString(),
};

describe("CartSummary", () => {
  it("links to /checkout/envio instead of a disabled button", () => {
    render(<CartSummary cart={BASE_CART} />);
    const link = screen.getByText("Ir a pagar").closest("a");
    expect(link).toHaveAttribute("href", "/checkout/envio");
  });

  it("no longer shows the 'Disponible próximamente' placeholder", () => {
    render(<CartSummary cart={BASE_CART} />);
    expect(screen.queryByTitle("Disponible próximamente")).not.toBeInTheDocument();
  });

  it("disables the CTA with an explanatory title when the cart has blocking lines", () => {
    render(<CartSummary cart={{ ...BASE_CART, hasBlockingLines: true }} />);
    expect(screen.getByRole("button", { name: "Pagar" })).toBeDisabled();
  });
});
