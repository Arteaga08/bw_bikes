import type { OrderStatusHistoryEntry } from "@bw-bikes/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderTimeline } from "./OrderTimeline";

const ENTRIES: OrderStatusHistoryEntry[] = [
  { status: "pending_payment", at: "2026-08-01T10:00:00.000Z", actorType: "user" },
  { status: "paid", at: "2026-08-01T10:05:00.000Z", actorType: "system" },
];

describe("OrderTimeline", () => {
  it("renders one entry per status, in Spanish", () => {
    render(<OrderTimeline entries={ENTRIES} />);

    expect(screen.getByText("pendiente de pago")).toBeInTheDocument();
    expect(screen.getByText("pagada")).toBeInTheDocument();
  });

  it("renders nothing when there is no history", () => {
    render(<OrderTimeline entries={[]} />);

    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
