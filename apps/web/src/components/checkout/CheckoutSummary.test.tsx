import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useCartMock } = vi.hoisted(() => ({ useCartMock: vi.fn() }));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));
vi.mock("@/components/cart/CouponForm", () => ({ CouponForm: () => <div>coupon-form</div> }));

const { CheckoutSummary } = await import("./CheckoutSummary");

const BASE_CART = {
  id: "cart-1",
  lines: [
    {
      itemType: "bike",
      sku: "BK-1",
      name: "Rhino Race",
      brand: "Rhino",
      qty: 1,
      lineTotalCents: 2_500_000,
      isPurchasable: true,
    },
  ],
  subtotalCents: 2_500_000,
  discountCents: 0,
  taxCents: 344_828,
  shippingCents: 0,
  totalCents: 2_500_000,
  captureMethod: "automatic",
  hasBlockingLines: false,
};

describe("CheckoutSummary", () => {
  it("renders the totals without any stock figure in the DOM", () => {
    useCartMock.mockReturnValue({ cart: BASE_CART });
    render(<CheckoutSummary cloudName="demo" />);
    expect(screen.getAllByText("$25,000.00").length).toBeGreaterThan(0);
    expect(screen.queryByText(/available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/onHand/i)).not.toBeInTheDocument();
  });

  it("shows the manual-capture notice when captureMethod is not automatic", () => {
    useCartMock.mockReturnValue({ cart: { ...BASE_CART, captureMethod: "manual" } });
    render(<CheckoutSummary cloudName="demo" />);
    expect(screen.getByText(/se autoriza ahora/)).toBeInTheDocument();
  });

  it("hides the manual-capture notice when captureMethod is automatic", () => {
    useCartMock.mockReturnValue({ cart: BASE_CART });
    render(<CheckoutSummary cloudName="demo" />);
    expect(screen.queryByText(/se autoriza ahora/)).not.toBeInTheDocument();
  });
});
