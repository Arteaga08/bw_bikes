import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeltaIndicator } from "./DeltaIndicator";

describe("DeltaIndicator", () => {
  it("says there is no baseline when the previous window is null, rather than inventing a percentage", () => {
    render(<DeltaIndicator current={100} previous={null} periodLabel="vs. periodo anterior" />);
    expect(screen.getByText("Sin base de comparación")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("treats a previous value of exactly 0 the same as no baseline, never rendering +Infinity%", () => {
    render(<DeltaIndicator current={100} previous={0} periodLabel="vs. periodo anterior" />);
    expect(screen.getByText("Sin base de comparación")).toBeInTheDocument();
  });

  it("shows no change, neutrally, when current equals previous", () => {
    render(<DeltaIndicator current={100} previous={100} periodLabel="vs. periodo anterior" />);
    expect(screen.getByText("Sin cambio vs. periodo anterior")).toBeInTheDocument();
  });

  it("renders a rising value as good news by default (goodDirection: up)", () => {
    render(<DeltaIndicator current={150} previous={100} periodLabel="vs. periodo anterior" />);
    const el = screen.getByText("+50% vs. periodo anterior");
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass("text-estado-exito");
  });

  it("renders a falling value as bad news by default", () => {
    render(<DeltaIndicator current={50} previous={100} periodLabel="vs. periodo anterior" />);
    const el = screen.getByText("-50% vs. periodo anterior");
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass("text-estado-error");
  });

  it("inverts the tone when goodDirection is down — a rising value reads as bad news", () => {
    render(<DeltaIndicator current={150} previous={100} goodDirection="down" periodLabel="vs. periodo anterior" />);
    const el = screen.getByText("+50% vs. periodo anterior");
    expect(el).toHaveClass("text-estado-error");
  });

  it("inverts the tone when goodDirection is down — a falling value reads as good news", () => {
    render(<DeltaIndicator current={50} previous={100} goodDirection="down" periodLabel="vs. periodo anterior" />);
    const el = screen.getByText("-50% vs. periodo anterior");
    expect(el).toHaveClass("text-estado-exito");
  });
});
