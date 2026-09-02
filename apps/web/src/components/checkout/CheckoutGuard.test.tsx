import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useCartMock } = vi.hoisted(() => ({ useCartMock: vi.fn() }));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));

const { CheckoutGuard } = await import("./CheckoutGuard");

const PURCHASABLE_CART = {
  id: "cart-1",
  lines: [{ itemType: "bike", sku: "BK-1", isPurchasable: true }],
  hasBlockingLines: false,
  subtotalCents: 100,
  totalCents: 100,
};

describe("CheckoutGuard", () => {
  it("shows the skeleton while loading, without navigating", () => {
    useCartMock.mockReturnValue({ cart: null, status: "loading" });
    render(<CheckoutGuard steps={<div>steps</div>} summary={<div>summary</div>} />);
    expect(screen.queryByText("steps")).not.toBeInTheDocument();
  });

  it("shows CartUnauthenticated when anonymous, without navigating", () => {
    useCartMock.mockReturnValue({ cart: null, status: "anonymous" });
    render(<CheckoutGuard steps={<div>steps</div>} summary={<div>summary</div>} />);
    expect(screen.getByText("Inicia sesión para ver tu carrito")).toBeInTheDocument();
  });

  it("shows an empty-cart message when the cart has no lines", () => {
    useCartMock.mockReturnValue({ cart: { ...PURCHASABLE_CART, lines: [] }, status: "ready" });
    render(<CheckoutGuard steps={<div>steps</div>} summary={<div>summary</div>} />);
    expect(screen.queryByText("steps")).not.toBeInTheDocument();
  });

  it("renders steps and summary for a purchasable cart", () => {
    useCartMock.mockReturnValue({ cart: PURCHASABLE_CART, status: "ready" });
    render(<CheckoutGuard steps={<div>steps</div>} summary={<div>summary</div>} />);
    expect(screen.getByText("steps")).toBeInTheDocument();
    expect(screen.getByText("summary")).toBeInTheDocument();
  });

  it("shows a blocking-lines banner and disables the steps fieldset, without hiding the form", () => {
    useCartMock.mockReturnValue({ cart: { ...PURCHASABLE_CART, hasBlockingLines: true }, status: "ready" });
    render(<CheckoutGuard steps={<div>steps</div>} summary={<div>summary</div>} />);
    expect(screen.getByText("steps")).toBeInTheDocument();
    expect(screen.getByText(/Ajusta los productos marcados/)).toBeInTheDocument();
    expect(screen.getByRole("group")).toBeDisabled();
  });
});
