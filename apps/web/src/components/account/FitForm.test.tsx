import type { CustomerFit } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setAccountFitMock } = vi.hoisted(() => ({ setAccountFitMock: vi.fn() }));
vi.mock("@/lib/api/account", () => ({ setAccountFit: setAccountFitMock }));

const { FitForm } = await import("./FitForm");

const EMPTY_FIT: CustomerFit = { gearSizes: [] };

describe("FitForm", () => {
  beforeEach(() => {
    setAccountFitMock.mockReset();
  });

  it("prefills the height and ride style when editing", () => {
    render(<FitForm fit={{ heightCm: 175, rideStyle: "balanced", gearSizes: [] }} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText("Estatura")).toHaveValue(175);
    expect(screen.getByRole("radio", { name: /Equilibrado/ })).toHaveAttribute("aria-checked", "true");
  });

  it("saves the height and ride style, keeping existing gear sizes untouched", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const gearSizes = [{ category: "helmet" as const, value: "M" }];
    const saved: CustomerFit = { heightCm: 180, rideStyle: "performance", gearSizes };
    setAccountFitMock.mockResolvedValue(saved);

    render(<FitForm fit={{ ...EMPTY_FIT, gearSizes }} onClose={onClose} onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Estatura"), "180");
    await user.click(screen.getByRole("radio", { name: /Deportivo/ }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(setAccountFitMock).toHaveBeenCalledWith({ heightCm: 180, rideStyle: "performance", gearSizes });
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(onClose).toHaveBeenCalled();
  });

  it("blocks submission with a height outside the valid range", async () => {
    const user = userEvent.setup();
    render(<FitForm fit={EMPTY_FIT} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText("Estatura"), "999");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("La estatura debe estar entre 100 y 230 cm.")).toBeInTheDocument();
    expect(setAccountFitMock).not.toHaveBeenCalled();
  });
});
