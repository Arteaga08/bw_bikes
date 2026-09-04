import type { AdminInventoryVariantRow } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VariantAdjustForm } from "./VariantAdjustForm";

function makeVariant(overrides: Partial<AdminInventoryVariantRow> = {}): AdminInventoryVariantRow {
  return {
    inventoryItemId: "item-1",
    sku: "BK-TARMAC-M",
    size: "M",
    fulfillmentMode: "in_stock",
    onHand: 10,
    reserved: 2,
    available: 8,
    lowStockThresholdUnits: 5,
    ...overrides,
  };
}

describe("VariantAdjustForm", () => {
  it("saves with an empty Motivo and omits reason from the payload entirely", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<VariantAdjustForm variant={makeVariant()} onSubmit={onSubmit} onCancel={vi.fn()} submitting={false} />);

    await user.type(screen.getByLabelText("Unidades"), "5");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSubmit).toHaveBeenCalledWith({ delta: 5 }, undefined);
  });

  it("sends the trimmed reason when Motivo is filled", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<VariantAdjustForm variant={makeVariant()} onSubmit={onSubmit} onCancel={vi.fn()} submitting={false} />);

    await user.type(screen.getByLabelText("Unidades"), "5");
    await user.type(screen.getByLabelText("Motivo (opcional)"), "Venta en tienda");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSubmit).toHaveBeenCalledWith({ delta: 5 }, "Venta en tienda");
  });

  it("rejects a Motivo over 200 characters instead of submitting", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<VariantAdjustForm variant={makeVariant()} onSubmit={onSubmit} onCancel={vi.fn()} submitting={false} />);

    await user.type(screen.getByLabelText("Unidades"), "5");
    await user.type(screen.getByLabelText("Motivo (opcional)"), "a".repeat(201));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Máximo 200 caracteres.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows an inline error for an invalid amount once the field is touched", async () => {
    const user = userEvent.setup();
    render(<VariantAdjustForm variant={makeVariant()} onSubmit={vi.fn()} onCancel={vi.fn()} submitting={false} />);

    const amountInput = screen.getByLabelText("Unidades");
    await user.click(amountInput);
    await user.tab();

    expect(await screen.findByText("Ingresa un número de unidades.")).toBeInTheDocument();
  });

  it("previews the resulting count for a delta entrada", async () => {
    const user = userEvent.setup();
    render(<VariantAdjustForm variant={makeVariant({ onHand: 10, reserved: 2 })} onSubmit={vi.fn()} onCancel={vi.fn()} submitting={false} />);

    await user.type(screen.getByLabelText("Unidades"), "5");

    expect(await screen.findByText("Quedarán 13 disponibles (15 en bodega).")).toBeInTheDocument();
  });

  it("previews the resulting count for an absolute recuento físico", async () => {
    const user = userEvent.setup();
    render(<VariantAdjustForm variant={makeVariant({ onHand: 10, reserved: 2 })} onSubmit={vi.fn()} onCancel={vi.fn()} submitting={false} />);

    await user.click(screen.getByRole("button", { name: /Recuento físico/ }));
    await user.type(screen.getByLabelText("Nuevo stock físico"), "20");

    expect(await screen.findByText("Quedarán 18 disponibles (20 en bodega).")).toBeInTheDocument();
  });

  it("submits a negative delta for 'Salieron'", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<VariantAdjustForm variant={makeVariant()} onSubmit={onSubmit} onCancel={vi.fn()} submitting={false} />);

    await user.click(screen.getByRole("button", { name: /Salieron/ }));
    await user.type(screen.getByLabelText("Unidades"), "3");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSubmit).toHaveBeenCalledWith({ delta: -3 }, undefined);
  });

  it("calls onCancel when Cancelar is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<VariantAdjustForm variant={makeVariant()} onSubmit={vi.fn()} onCancel={onCancel} submitting={false} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
