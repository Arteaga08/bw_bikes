import type { BillingInfo } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setAccountBillingInfoMock } = vi.hoisted(() => ({ setAccountBillingInfoMock: vi.fn() }));
vi.mock("@/lib/api/account", () => ({ setAccountBillingInfo: setAccountBillingInfoMock }));

const { BillingInfoForm } = await import("./BillingInfoForm");

const EXISTING: BillingInfo = {
  rfc: "XAXX010101000",
  legalName: "Ana Pérez",
  cfdiUse: "G03",
  taxRegime: "605",
  postalCode: "06600",
};

describe("BillingInfoForm", () => {
  beforeEach(() => {
    setAccountBillingInfoMock.mockReset();
  });

  it("blocks submission with an invalid RFC", async () => {
    const user = userEvent.setup();
    render(<BillingInfoForm onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText("RFC"), "123");
    await user.type(screen.getByLabelText("Razón social"), "Ana Pérez");
    await user.type(screen.getByLabelText("Código postal fiscal"), "06600");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("El RFC no tiene un formato válido.")).toBeInTheDocument();
    expect(setAccountBillingInfoMock).not.toHaveBeenCalled();
  });

  it("prefills the fields when editing", () => {
    render(<BillingInfoForm initial={EXISTING} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText("RFC")).toHaveValue("XAXX010101000");
    expect(screen.getByLabelText("Razón social")).toHaveValue("Ana Pérez");
    expect(screen.getByLabelText("Código postal fiscal")).toHaveValue("06600");
  });

  it("saves valid fiscal data and calls onSaved + onClose", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    setAccountBillingInfoMock.mockResolvedValue(EXISTING);

    render(<BillingInfoForm onClose={onClose} onSaved={onSaved} />);

    await user.type(screen.getByLabelText("RFC"), EXISTING.rfc);
    await user.type(screen.getByLabelText("Razón social"), EXISTING.legalName);
    await user.type(screen.getByLabelText("Código postal fiscal"), EXISTING.postalCode);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(setAccountBillingInfoMock).toHaveBeenCalledWith(
      expect.objectContaining({ rfc: EXISTING.rfc, legalName: EXISTING.legalName, postalCode: EXISTING.postalCode }),
    );
    expect(onSaved).toHaveBeenCalledWith(EXISTING);
    expect(onClose).toHaveBeenCalled();
  });
});
