import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatsRangePicker } from "./StatsRangePicker";

describe("StatsRangePicker", () => {
  it("fires onChange with just the preset for a fixed window", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StatsRangePicker value={{ preset: "30d" }} onChange={onChange} />);

    await user.click(screen.getByRole("tab", { name: "7 días" }));

    expect(onChange).toHaveBeenCalledWith({ preset: "7d" });
  });

  it("reveals two date inputs only when Personalizado is selected", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StatsRangePicker value={{ preset: "30d" }} onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Desde")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Personalizado" }));
    rerender(<StatsRangePicker value={{ preset: "custom" }} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Desde")).toBeInTheDocument();
    expect(screen.getByLabelText("Hasta")).toBeInTheDocument();
  });

  it("does not fire onChange for a custom range until both dates are set", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StatsRangePicker value={{ preset: "custom" }} onChange={onChange} />);

    await user.type(screen.getByLabelText("Desde"), "2026-08-01");
    expect(onChange).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Hasta"), "2026-08-10");
    expect(onChange).toHaveBeenLastCalledWith({ preset: "custom", from: "2026-08-01", to: "2026-08-10" });
  });

  it("shows an inline error, and does not fire onChange, when from is not before to", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StatsRangePicker value={{ preset: "custom", from: "2026-08-10" }} onChange={onChange} />);

    await user.type(screen.getByLabelText("Hasta"), "2026-08-01");

    expect(screen.getByText('"Desde" debe ser anterior a "hasta".')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
