import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SizeSelector, type SizeOption } from "./SizeSelector";

const SIZES: SizeOption[] = [
  { value: "MD", available: true },
  { value: "LG", available: false },
];

describe("SizeSelector", () => {
  it("renders nothing when there are no sizes", () => {
    const { container } = render(<SizeSelector sizes={[]} selected={undefined} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one radio per size, disabling the unavailable one", () => {
    render(<SizeSelector sizes={SIZES} selected={undefined} onSelect={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "MD" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "LG" })).toBeDisabled();
  });

  it("marks the selected size checked", () => {
    render(<SizeSelector sizes={SIZES} selected="MD" onSelect={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "MD" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "LG" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onSelect for an available size but not for a disabled one", () => {
    const onSelect = vi.fn();
    render(<SizeSelector sizes={SIZES} selected={undefined} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("radio", { name: "MD" }));
    expect(onSelect).toHaveBeenCalledWith("MD");

    fireEvent.click(screen.getByRole("radio", { name: "LG" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
