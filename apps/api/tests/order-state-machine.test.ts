import type { OrderStatus } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, assertTransition, canTransition, isTerminal } from "../src/services/order-state.js";
import { AppError } from "../src/utils/index.js";

/**
 * The allowed edges, written out **by hand** rather than imported from the
 * implementation. A test that derives its expectation from the table it is
 * testing proves only that the table equals itself; this one is an independent
 * transcription of the state machine in the design spec, so a wrong edge in
 * either place shows up as a failure.
 */
const ALLOWED: readonly [OrderStatus, OrderStatus][] = [
  // The customer paid a cart that was entirely in stock: charged straight away.
  ["pending_payment", "paid"],
  // Manual capture: the card was authorized, nothing charged yet.
  ["pending_payment", "authorized"],
  // Payment failed, checkout abandoned, or a line ran out of stock mid-flight.
  ["pending_payment", "cancelled"],

  // Authorization always lands in the admin queue.
  ["authorized", "awaiting_supplier_confirmation"],
  ["authorized", "cancelled"],
  ["authorized", "authorization_expired"],

  ["awaiting_supplier_confirmation", "paid"],
  ["awaiting_supplier_confirmation", "cancelled"],
  ["awaiting_supplier_confirmation", "authorization_expired"],

  ["paid", "processing"],
  ["paid", "refunded"],

  ["processing", "shipped"],
  ["processing", "refunded"],

  ["shipped", "delivered"],
  ["shipped", "refunded"],

  ["delivered", "refunded"],
];

const isAllowed = (from: OrderStatus, to: OrderStatus): boolean =>
  ALLOWED.some(([f, t]) => f === from && t === to);

describe("order state machine", () => {
  it("exposes every status in the shared union exactly once", () => {
    expect(new Set(ORDER_STATUSES).size).toBe(ORDER_STATUSES.length);
    expect(ORDER_STATUSES).toHaveLength(10);
  });

  it("matches the expected transition matrix for all 100 combinations", () => {
    const mismatches: string[] = [];

    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (canTransition(from, to) !== isAllowed(from, to)) {
          mismatches.push(`${from} -> ${to}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("never allows a status to transition to itself", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("never allows a backwards jump down the happy path", () => {
    const forward: OrderStatus[] = ["pending_payment", "authorized", "awaiting_supplier_confirmation", "paid", "processing", "shipped", "delivered"];

    for (let i = 0; i < forward.length; i++) {
      for (let j = 0; j < i; j++) {
        expect(canTransition(forward[i]!, forward[j]!)).toBe(false);
      }
    }
  });

  it("never allows skipping straight from pending_payment to a fulfilment status", () => {
    for (const to of ["processing", "shipped", "delivered", "refunded"] as OrderStatus[]) {
      expect(canTransition("pending_payment", to)).toBe(false);
    }
  });

  it("treats cancelled, authorization_expired and refunded as terminal", () => {
    for (const status of ["cancelled", "authorization_expired", "refunded"] as OrderStatus[]) {
      expect(isTerminal(status)).toBe(true);
      for (const to of ORDER_STATUSES) {
        expect(canTransition(status, to)).toBe(false);
      }
    }
  });

  it("does not treat delivered as terminal, because a refund can still follow", () => {
    expect(isTerminal("delivered")).toBe(false);
    expect(canTransition("delivered", "refunded")).toBe(true);
  });

  it("never lets an unpaid order reach refunded — there is nothing to give back", () => {
    for (const from of ["pending_payment", "authorized", "awaiting_supplier_confirmation"] as OrderStatus[]) {
      expect(canTransition(from, "refunded")).toBe(false);
    }
  });

  it("never lets a captured order fall back to cancelled — a charged order is refunded, not cancelled", () => {
    for (const from of ["paid", "processing", "shipped", "delivered"] as OrderStatus[]) {
      expect(canTransition(from, "cancelled")).toBe(false);
    }
  });

  describe("assertTransition", () => {
    it("passes silently on a valid transition", () => {
      expect(() => assertTransition("pending_payment", "paid")).not.toThrow();
    });

    it("throws an operational 409 naming both states", () => {
      let thrown: unknown;
      try {
        assertTransition("delivered", "pending_payment");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AppError);
      expect((thrown as AppError).statusCode).toBe(409);
      expect((thrown as AppError).message).toContain("entregada");
      expect((thrown as AppError).message).toContain("pendiente de pago");
    });
  });
});
