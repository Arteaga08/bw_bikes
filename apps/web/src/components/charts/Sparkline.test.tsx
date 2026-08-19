import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./Sparkline";

const dayPoints = (values: number[]) => values.map((value, index) => ({ date: `2026-08-${10 + index}`, value }));

describe("Sparkline", () => {
  it("renders nothing below 4 points — too few for a trend to mean anything", () => {
    const { container } = render(<Sparkline points={dayPoints([1, 2, 3])} ariaLabel="Tendencia" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an empty series (0 points) as nothing, not an error", () => {
    const { container } = render(<Sparkline points={[]} ariaLabel="Tendencia" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a line once there are at least 4 points", () => {
    render(<Sparkline points={dayPoints([1, 4, 2, 8])} ariaLabel="Tendencia de ingresos" />);
    expect(screen.getByRole("img", { name: "Tendencia de ingresos" })).toBeInTheDocument();
  });

  it("does not divide by zero when every value in the series is identical", () => {
    render(<Sparkline points={dayPoints([5, 5, 5, 5])} ariaLabel="Tendencia plana" />);
    const svg = screen.getByRole("img", { name: "Tendencia plana" });
    const polyline = svg.querySelector("polyline");
    expect(polyline?.getAttribute("points")).not.toMatch(/NaN/);
  });
});
