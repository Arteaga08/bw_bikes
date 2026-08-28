import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("renders a native checkbox associated with its label", () => {
    render(<Checkbox label="Carbono" checked={false} onChange={() => {}} />);
    const input = screen.getByRole("checkbox", { name: "Carbono" });
    expect(input).toBeInTheDocument();
    expect(input).not.toBeChecked();
  });

  it("reflects the checked state on the native input", () => {
    render(<Checkbox label="Carbono" checked onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Carbono" })).toBeChecked();
  });

  it("toggles via click and forwards the change event", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Carbono" checked={false} onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Carbono" }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("hides the label text visually but keeps it for the accessible name", () => {
    render(<Checkbox label="Negro mate" labelHidden checked={false} onChange={() => {}} />);
    const input = screen.getByRole("checkbox", { name: "Negro mate" });
    expect(input).toBeInTheDocument();
    const labelText = screen.getByText("Negro mate");
    expect(labelText).toHaveClass("sr-only");
  });

  it("disables the input and stops accepting clicks", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Carbono" checked={false} onChange={onChange} disabled />);

    const input = screen.getByRole("checkbox", { name: "Carbono" });
    expect(input).toBeDisabled();

    await userEvent.click(input);
    expect(onChange).not.toHaveBeenCalled();
  });
});
