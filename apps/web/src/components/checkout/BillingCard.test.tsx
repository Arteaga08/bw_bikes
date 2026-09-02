import type { BillingInfo } from "@bw-bikes/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setBillingInfoMock, removeBillingInfoMock, useCartMock } = vi.hoisted(() => ({
  setBillingInfoMock: vi.fn(),
  removeBillingInfoMock: vi.fn(),
  useCartMock: vi.fn(),
}));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: useCartMock }));

const { BillingCard } = await import("./BillingCard");

const SAVED_BILLING: BillingInfo = {
  rfc: "XAXX010101000",
  legalName: "Ana Pérez",
  cfdiUse: "G03",
  taxRegime: "605",
  postalCode: "06600",
};

describe("BillingCard", () => {
  beforeEach(() => {
    setBillingInfoMock.mockReset().mockResolvedValue(undefined);
    removeBillingInfoMock.mockReset().mockResolvedValue(undefined);
  });

  it("starts unchecked and collapsed when the cart has no billing info", () => {
    useCartMock.mockReturnValue({
      cart: { billingInfo: undefined },
      setBillingInfo: setBillingInfoMock,
      removeBillingInfo: removeBillingInfoMock,
    });
    render(<BillingCard initialBillingInfo={undefined} />);
    expect(screen.getByRole("checkbox", { name: "Necesito factura (CFDI)" })).not.toBeChecked();
    expect(screen.queryByLabelText("RFC")).not.toBeInTheDocument();
  });

  it("checking the box reveals the fields, pre-filled from the account's saved billing info", async () => {
    useCartMock.mockReturnValue({
      cart: { billingInfo: undefined },
      setBillingInfo: setBillingInfoMock,
      removeBillingInfo: removeBillingInfoMock,
    });
    const user = userEvent.setup();
    render(<BillingCard initialBillingInfo={SAVED_BILLING} />);

    await user.click(screen.getByRole("checkbox", { name: "Necesito factura (CFDI)" }));

    expect(screen.getByLabelText("RFC")).toHaveValue("XAXX010101000");
  });

  it("saving valid CFDI data calls setBillingInfo and collapses the card", async () => {
    useCartMock.mockReturnValue({
      cart: { billingInfo: undefined },
      setBillingInfo: setBillingInfoMock,
      removeBillingInfo: removeBillingInfoMock,
    });
    const user = userEvent.setup();
    render(<BillingCard initialBillingInfo={undefined} />);

    await user.click(screen.getByRole("checkbox", { name: "Necesito factura (CFDI)" }));
    await user.type(screen.getByLabelText("RFC"), "XAXX010101000");
    await user.type(screen.getByLabelText("Razón social"), "Ana Pérez");
    await user.type(screen.getByLabelText("Código postal fiscal"), "06600");
    await user.click(screen.getByRole("button", { name: "Guardar datos fiscales" }));

    await waitFor(() => expect(setBillingInfoMock).toHaveBeenCalled());
    expect(setBillingInfoMock).toHaveBeenCalledWith(
      expect.objectContaining({ rfc: "XAXX010101000", legalName: "Ana Pérez", postalCode: "06600" }),
    );
  });

  it("unchecking after it was saved calls removeBillingInfo", async () => {
    useCartMock.mockReturnValue({
      cart: { billingInfo: SAVED_BILLING },
      setBillingInfo: setBillingInfoMock,
      removeBillingInfo: removeBillingInfoMock,
    });
    const user = userEvent.setup();
    render(<BillingCard initialBillingInfo={SAVED_BILLING} />);

    await user.click(screen.getByRole("checkbox", { name: "Necesito factura (CFDI)" }));

    await waitFor(() => expect(removeBillingInfoMock).toHaveBeenCalled());
  });

  it("rolls back to checked when removeBillingInfo fails, instead of showing a false unchecked state", async () => {
    const { ApiError } = await import("@/lib/api/error");
    removeBillingInfoMock.mockRejectedValue(new ApiError("No se pudo conectar con el servidor.", 500));
    useCartMock.mockReturnValue({
      cart: { billingInfo: SAVED_BILLING },
      setBillingInfo: setBillingInfoMock,
      removeBillingInfo: removeBillingInfoMock,
    });
    const user = userEvent.setup();
    render(<BillingCard initialBillingInfo={SAVED_BILLING} />);

    await user.click(screen.getByRole("checkbox", { name: "Necesito factura (CFDI)" }));

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Necesito factura (CFDI)" })).toBeChecked());
    expect(screen.getByText("No se pudo conectar con el servidor.")).toBeInTheDocument();
  });
});
