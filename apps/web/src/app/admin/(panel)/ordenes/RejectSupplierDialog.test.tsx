import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RejectSupplierDialog } from "./RejectSupplierDialog";

describe("RejectSupplierDialog", () => {
  it("keeps the submit button disabled for a reason shorter than 5 characters", () => {
    render(
      <RejectSupplierDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        orderNumber="BW-2026-K7XQ2M"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("Motivo del rechazo"), { target: { value: "abcd" } });

    const submit = screen.getByRole("button", { name: "Rechazar y liberar stock" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("El motivo debe tener al menos 5 caracteres.")).toBeInTheDocument();
  });

  it("enables submit and calls onConfirm with the trimmed reason once valid", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <RejectSupplierDialog
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        orderNumber="BW-2026-K7XQ2M"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("Motivo del rechazo"), {
      target: { value: "  Proveedor sin existencias.  " },
    });

    const submit = screen.getByRole("button", { name: "Rechazar y liberar stock" });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledWith("Proveedor sin existencias.");
  });

  it("disables submit for a reason longer than 300 characters", () => {
    render(
      <RejectSupplierDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        orderNumber="BW-2026-K7XQ2M"
        submitting={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("Motivo del rechazo"), { target: { value: "x".repeat(301) } });

    expect(screen.getByRole("button", { name: "Rechazar y liberar stock" })).toBeDisabled();
  });

  it("does not shame an untouched field", () => {
    render(
      <RejectSupplierDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        orderNumber="BW-2026-K7XQ2M"
        submitting={false}
      />,
    );
    expect(screen.getByText("0/300 caracteres")).toBeInTheDocument();
  });
});
