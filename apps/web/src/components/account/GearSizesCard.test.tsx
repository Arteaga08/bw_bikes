import type { CustomerFit } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setAccountFitMock } = vi.hoisted(() => ({ setAccountFitMock: vi.fn() }));
vi.mock("@/lib/api/account", () => ({ setAccountFit: setAccountFitMock }));

const { GearSizesCard } = await import("./GearSizesCard");

describe("GearSizesCard", () => {
  beforeEach(() => {
    setAccountFitMock.mockReset();
  });

  it("shows every category, saved values and 'Añadir talla +' for the rest", () => {
    const fit: CustomerFit = { gearSizes: [{ category: "helmet", value: "M" }] };
    render(<GearSizesCard fit={fit} onSaved={vi.fn()} />);

    expect(screen.getByText("Cascos")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("Ancho del manubrio")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Añadir talla +" }).length).toBeGreaterThan(0);
  });

  it("adds a size for a category with none saved yet", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const fit: CustomerFit = { gearSizes: [] };
    const saved: CustomerFit = { gearSizes: [{ category: "helmet", value: "L" }] };
    setAccountFitMock.mockResolvedValue(saved);

    render(<GearSizesCard fit={fit} onSaved={onSaved} />);

    const [helmetAdd] = screen.getAllByRole("button", { name: "Añadir talla +" });
    await user.click(helmetAdd!);
    await user.type(screen.getByLabelText("Talla"), "L");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(setAccountFitMock).toHaveBeenCalledWith({ gearSizes: [{ category: "helmet", value: "L" }] });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("replaces the value for a category that already has one, without duplicating it", async () => {
    const user = userEvent.setup();
    const fit: CustomerFit = { gearSizes: [{ category: "helmet", value: "M" }] };
    setAccountFitMock.mockResolvedValue({ gearSizes: [{ category: "helmet", value: "L" }] });

    render(<GearSizesCard fit={fit} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    const input = screen.getByLabelText("Talla");
    await user.clear(input);
    await user.type(input, "L");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(setAccountFitMock).toHaveBeenCalledWith({ gearSizes: [{ category: "helmet", value: "L" }] });
  });
});
