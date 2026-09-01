import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuantityStepper } from "./QuantityStepper";

describe("QuantityStepper", () => {
  it("calls onChange with qty + 1 / qty - 1", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuantityStepper qty={3} max={10} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Aumentar cantidad" }));
    expect(onChange).toHaveBeenCalledWith(4);

    await user.click(screen.getByRole("button", { name: "Disminuir cantidad" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("disables '+' at the max without ever rendering the number that produced it", () => {
    const { container } = render(<QuantityStepper qty={5} max={5} onChange={vi.fn()} />);

    const increment = screen.getByRole("button", { name: "Aumentar cantidad" });
    expect(increment).toBeDisabled();
    expect(increment).toHaveAttribute("title", "No hay más unidades disponibles");
    expect(container).not.toHaveTextContent("5 disponibles");
  });

  it("disables '-' at 1", () => {
    render(<QuantityStepper qty={1} max={10} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Disminuir cantidad" })).toBeDisabled();
  });

  it("never renders a stock count in the DOM", () => {
    const { container } = render(<QuantityStepper qty={2} max={7} onChange={vi.fn()} />);
    expect(container.textContent).not.toMatch(/\b7\b/);
  });
});
