import type { AdminInventoryItem } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StockAdjustDialog } from "./StockAdjustDialog";

function makeItem(overrides: Partial<AdminInventoryItem> = {}): AdminInventoryItem {
  return {
    id: "item-1",
    itemType: "bike",
    itemId: "bike-1",
    sku: "BK-TARMAC-M",
    onHand: 10,
    reserved: 2,
    available: 8,
    product: { name: "Tarmac SL7", brand: "Specialized" },
    variant: { size: "M", fulfillmentMode: "in_stock" },
    lowStockThresholdUnits: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("StockAdjustDialog", () => {
  it("titles the modal with the product name, not just the SKU", () => {
    render(<StockAdjustDialog item={makeItem()} onClose={vi.fn()} onConfirm={vi.fn()} submitting={false} />);
    expect(screen.getByRole("heading", { name: "Ajustar Tarmac SL7" })).toBeInTheDocument();
  });

  it("shows an inline error instead of a silently disabled button when Motivo is missing", async () => {
    const user = userEvent.setup();
    render(<StockAdjustDialog item={makeItem()} onClose={vi.fn()} onConfirm={vi.fn()} submitting={false} />);

    await user.type(screen.getByLabelText("Unidades"), "5");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Este campo es obligatorio.")).toBeInTheDocument();
  });

  it("shows an inline error for an invalid amount once the field is touched", async () => {
    const user = userEvent.setup();
    render(<StockAdjustDialog item={makeItem()} onClose={vi.fn()} onConfirm={vi.fn()} submitting={false} />);

    const amountInput = screen.getByLabelText("Unidades");
    await user.click(amountInput);
    await user.tab();

    expect(await screen.findByText("Ingresa un número de unidades.")).toBeInTheDocument();
  });

  it("previews the resulting count for a delta entrada", async () => {
    const user = userEvent.setup();
    render(<StockAdjustDialog item={makeItem({ onHand: 10, reserved: 2 })} onClose={vi.fn()} onConfirm={vi.fn()} submitting={false} />);

    await user.type(screen.getByLabelText("Unidades"), "5");

    expect(await screen.findByText("Quedarán 13 disponibles (15 en bodega).")).toBeInTheDocument();
  });

  it("previews the resulting count for an absolute recuento físico", async () => {
    const user = userEvent.setup();
    render(<StockAdjustDialog item={makeItem({ onHand: 10, reserved: 2 })} onClose={vi.fn()} onConfirm={vi.fn()} submitting={false} />);

    await user.click(screen.getByRole("button", { name: /Recuento físico/ }));
    await user.type(screen.getByLabelText("Nuevo stock físico"), "20");

    expect(await screen.findByText("Quedarán 18 disponibles (20 en bodega).")).toBeInTheDocument();
  });

  it("submits a negative delta for 'Salieron'", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<StockAdjustDialog item={makeItem()} onClose={vi.fn()} onConfirm={onConfirm} submitting={false} />);

    await user.click(screen.getByRole("button", { name: /Salieron/ }));
    await user.type(screen.getByLabelText("Unidades"), "3");
    await user.type(screen.getByLabelText("Motivo"), "Unidad dañada");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onConfirm).toHaveBeenCalledWith({ delta: -3 }, "Unidad dañada");
  });
});
