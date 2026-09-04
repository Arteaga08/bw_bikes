import type { OrderStatus } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { BULK_ALLOWED_STATUSES, ORDER_STATUS_GROUPS, ORDER_STATUS_LABELS, orderStatusBadgeVariant } from "./status";

const ALL_STATUSES: OrderStatus[] = [
  "pending_payment",
  "authorized",
  "awaiting_supplier_confirmation",
  "authorization_expired",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

describe("ORDER_STATUS_LABELS", () => {
  it("has a non-empty Spanish label for every order status", () => {
    for (const status of ALL_STATUSES) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("orderStatusBadgeVariant", () => {
  it("maps every status to one of the semantic Badge variants", () => {
    for (const status of ALL_STATUSES) {
      expect(["exito", "advertencia", "error"]).toContain(orderStatusBadgeVariant(status));
    }
  });

  it("reads success for money-captured, in-flight-to-delivery states", () => {
    expect(orderStatusBadgeVariant("paid")).toBe("exito");
    expect(orderStatusBadgeVariant("processing")).toBe("exito");
    expect(orderStatusBadgeVariant("shipped")).toBe("exito");
    expect(orderStatusBadgeVariant("delivered")).toBe("exito");
  });

  it("reads error for terminal states that ended without a sale", () => {
    expect(orderStatusBadgeVariant("cancelled")).toBe("error");
    expect(orderStatusBadgeVariant("authorization_expired")).toBe("error");
    expect(orderStatusBadgeVariant("refunded")).toBe("error");
  });
});

describe("BULK_ALLOWED_STATUSES", () => {
  it("matches the backend's BULK_ALLOWED_STATUSES exactly", () => {
    expect(BULK_ALLOWED_STATUSES).toEqual(["processing", "delivered"]);
  });
});

describe("ORDER_STATUS_GROUPS", () => {
  it("places every order status in exactly one group", () => {
    const seen = Object.values(ORDER_STATUS_GROUPS).flat();
    expect(seen.sort()).toEqual([...ALL_STATUSES].sort());
    expect(new Set(seen).size).toBe(ALL_STATUSES.length);
  });
});
