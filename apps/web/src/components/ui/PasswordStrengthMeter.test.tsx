import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

function segments(container: HTMLElement) {
  return Array.from(container.querySelector('[role="presentation"]')!.children) as HTMLElement[];
}

describe("PasswordStrengthMeter", () => {
  it("paints no segment as filled for an empty password", () => {
    const { container } = render(<PasswordStrengthMeter id="pw" password="" />);
    for (const segment of segments(container)) {
      expect(segment).toHaveClass("bg-inset");
      expect(segment).not.toHaveClass("bg-estado-error", "bg-estado-advertencia", "bg-estado-exito");
    }
  });

  it("fills exactly the met segments with the tier color, in order", () => {
    // Meets length + uppercase (2 of 4) -> "Media" tier.
    const { container } = render(<PasswordStrengthMeter id="pw" password="Password" />);
    const [first, second, third, fourth] = segments(container);

    expect(first).toHaveClass("bg-estado-advertencia");
    expect(second).toHaveClass("bg-estado-advertencia");
    expect(third).toHaveClass("bg-inset");
    expect(fourth).toHaveClass("bg-inset");
    expect(screen.getByText("Fortaleza: Media")).toBeInTheDocument();
  });

  it("fills every segment green once all four requirements are met", () => {
    const { container } = render(<PasswordStrengthMeter id="pw" password="Correct-Horse-1" />);
    for (const segment of segments(container)) {
      expect(segment).toHaveClass("bg-estado-exito");
    }
    expect(screen.getByText("Fortaleza: Fuerte")).toBeInTheDocument();
  });
});
