import type { OrderTotals } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderSummaryTable } from "./OrderSummaryTable";

const TOTALS: OrderTotals = {
  subtotalCents: 100_000,
  discountCents: 0,
  taxCents: 13_793,
  shippingCents: 0,
  totalCents: 100_000,
  currency: "MXN",
};

describe("OrderSummaryTable", () => {
  it("shows the total and free shipping", () => {
    render(<OrderSummaryTable totals={TOTALS} />);

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Gratis")).toBeInTheDocument();
    expect(screen.queryByText("Descuento")).not.toBeInTheDocument();
  });

  it("shows the discount row only when a discount was applied", () => {
    render(<OrderSummaryTable totals={{ ...TOTALS, discountCents: 5_000 }} />);

    expect(screen.getByText("Descuento")).toBeInTheDocument();
  });

  it("shows the shipping charge when it is not free", () => {
    render(<OrderSummaryTable totals={{ ...TOTALS, shippingCents: 25_000 }} />);

    expect(screen.queryByText("Gratis")).not.toBeInTheDocument();
  });
});
