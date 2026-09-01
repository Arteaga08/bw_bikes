import type { PublicCartLine } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { useCartMock } = vi.hoisted(() => ({ useCartMock: vi.fn() }));
vi.mock("./CartProvider", () => ({ useCart: useCartMock }));

const { CartLineItem } = await import("./CartLineItem");

function makeLine(overrides: Partial<PublicCartLine> = {}): PublicCartLine {
  return {
    itemType: "bike",
    itemId: "item-1",
    sku: "SKU-1",
    slug: "bici-x",
    name: "Bici X",
    brand: "Trek",
    fulfillmentMode: "in_stock",
    unitPriceCents: 100000,
    qty: 2,
    lineTotalCents: 200000,
    available: 5,
    isPurchasable: true,
    ...overrides,
  };
}

describe("CartLineItem", () => {
  it("shows name, brand and price, with no stock number anywhere in the DOM", () => {
    useCartMock.mockReturnValue({ setQty: vi.fn(), removeLine: vi.fn(), isPending: () => false });
    const { container } = render(<CartLineItem line={makeLine()} cloudName="demo" />);

    expect(screen.getByText("Bici X")).toBeInTheDocument();
    expect(screen.getByText("Trek")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b5\b/);
  });

  it("calls setQty when the stepper changes", async () => {
    const setQty = vi.fn();
    useCartMock.mockReturnValue({ setQty, removeLine: vi.fn(), isPending: () => false });
    const user = userEvent.setup();
    render(<CartLineItem line={makeLine({ qty: 2 })} cloudName="demo" />);

    await user.click(screen.getByRole("button", { name: "Aumentar cantidad" }));
    expect(setQty).toHaveBeenCalledWith("bike", "SKU-1", 3);
  });

  it("calls removeLine when the trash button is clicked", async () => {
    const removeLine = vi.fn();
    useCartMock.mockReturnValue({ setQty: vi.fn(), removeLine, isPending: () => false });
    const user = userEvent.setup();
    render(<CartLineItem line={makeLine()} cloudName="demo" />);

    await user.click(screen.getByRole("button", { name: "Eliminar Bici X del carrito" }));
    expect(removeLine).toHaveBeenCalledWith("bike", "SKU-1");
  });

  it("shows a non-purchasable line's status message without a count", () => {
    useCartMock.mockReturnValue({ setQty: vi.fn(), removeLine: vi.fn(), isPending: () => false });
    render(
      <CartLineItem
        line={makeLine({ isPurchasable: false, available: 0, unavailableReason: "Este producto está agotado." })}
        cloudName="demo"
      />,
    );

    expect(screen.getByText("Este producto está agotado.")).toBeInTheDocument();
  });

  it("rewrites the partial-stock backend message into a number-free hint", () => {
    useCartMock.mockReturnValue({ setQty: vi.fn(), removeLine: vi.fn(), isPending: () => false });
    render(
      <CartLineItem
        line={makeLine({ isPurchasable: false, available: 2, qty: 5, unavailableReason: "Solo quedan 2 unidades disponibles." })}
        cloudName="demo"
      />,
    );

    expect(screen.getByText("Ajusta la cantidad para continuar.")).toBeInTheDocument();
    expect(screen.queryByText(/Solo quedan/)).not.toBeInTheDocument();
  });
});
