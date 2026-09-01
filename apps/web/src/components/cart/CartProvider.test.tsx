import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/error";

const { getCartMock, addCartLineMock, useToastMock } = vi.hoisted(() => ({
  getCartMock: vi.fn(),
  addCartLineMock: vi.fn(),
  useToastMock: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock("@/lib/api/cart", () => ({
  getCart: getCartMock,
  addCartLine: addCartLineMock,
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  applyCartCoupon: vi.fn(),
  removeCartCoupon: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: useToastMock }));

const { CartProvider, useCart } = await import("./CartProvider");

const CART = { id: "cart-1", lines: [{ itemType: "bike", sku: "SKU-1", qty: 2 }], subtotalCents: 100 };

function Harness() {
  const { status, lineCount, addLine } = useCart();
  return (
    <div>
      <p>status:{status}</p>
      <p>lineCount:{lineCount}</p>
      <button onClick={() => void addLine("bike", "item-1", "SKU-1", 1).catch(() => {})}>add</button>
    </div>
  );
}

describe("CartProvider", () => {
  it("hydrates to 'ready' on a successful GET /cart", async () => {
    getCartMock.mockResolvedValue(CART);
    render(
      <CartProvider>
        <Harness />
      </CartProvider>,
    );

    await waitFor(() => expect(screen.getByText("status:ready")).toBeInTheDocument());
    expect(screen.getByText("lineCount:2")).toBeInTheDocument();
  });

  it("hydrates to 'anonymous' on a 401 without navigating anywhere", async () => {
    getCartMock.mockRejectedValue(new ApiError("No autenticado.", 401));
    render(
      <CartProvider>
        <Harness />
      </CartProvider>,
    );

    await waitFor(() => expect(screen.getByText("status:anonymous")).toBeInTheDocument());
  });

  it("replaces the cart wholesale after a mutation", async () => {
    getCartMock.mockResolvedValue({ id: "cart-1", lines: [], subtotalCents: 0 });
    addCartLineMock.mockResolvedValue(CART);
    const user = userEvent.setup();
    render(
      <CartProvider>
        <Harness />
      </CartProvider>,
    );

    await waitFor(() => expect(screen.getByText("lineCount:0")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "add" }));

    await waitFor(() => expect(screen.getByText("lineCount:2")).toBeInTheDocument());
  });

  it("shows a toast on a non-401 mutation error and leaves the cart untouched", async () => {
    const toast = vi.fn();
    useToastMock.mockReturnValue({ toast });
    getCartMock.mockResolvedValue(CART);
    addCartLineMock.mockRejectedValue(new ApiError("El SKU ya no está disponible.", 409));
    const user = userEvent.setup();
    render(
      <CartProvider>
        <Harness />
      </CartProvider>,
    );

    await waitFor(() => expect(screen.getByText("lineCount:2")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "add" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: "error", title: "El SKU ya no está disponible." }));
    expect(screen.getByText("lineCount:2")).toBeInTheDocument();
  });
});
