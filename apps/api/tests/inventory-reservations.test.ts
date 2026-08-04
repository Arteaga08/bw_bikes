import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supportsTransactions } from "../src/config/db.js";
import { InventoryItem, StockReservation } from "../src/models/index.js";
import { inventoryService } from "../src/services/inventory.service.js";
import { AppError } from "../src/utils/index.js";
import { createInventoryItemDoc } from "./helpers/factories.js";

const BIKE_ID = new Types.ObjectId();
const SKU = "BK-TARMAC-M";

function line(overrides: Record<string, unknown> = {}) {
  return {
    itemType: "bike" as const,
    itemId: String(BIKE_ID),
    sku: SKU,
    qty: 1,
    fulfillmentMode: "in_stock" as const,
    ...overrides,
  };
}

function reference(id = new Types.ObjectId()) {
  return { referenceType: "order" as const, referenceId: String(id) };
}

/** Re-reads the row so assertions never trust the in-memory copy the service returned. */
async function readCounters(sku = SKU) {
  const item = await InventoryItem.findOne({ itemType: "bike", itemId: BIKE_ID, sku }).exec();
  return { onHand: item?.onHand ?? 0, reserved: item?.reserved ?? 0 };
}

/**
 * The invariant the whole milestone exists to protect. Asserted after every
 * concurrency case, because "one request got a 409" is only half the proof —
 * the other half is that the loser never touched the winner's document.
 */
async function expectInventoryNeverNegative(): Promise<void> {
  const items = await InventoryItem.find().exec();
  for (const item of items) {
    expect(item.onHand).toBeGreaterThanOrEqual(0);
    expect(item.reserved).toBeGreaterThanOrEqual(0);
    expect(item.onHand - item.reserved).toBeGreaterThanOrEqual(0);
  }
}

describe("stock reservation under concurrency", () => {
  it("gives the last unit to exactly one of two simultaneous requests", async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 1 });

    const results = await Promise.allSettled([
      inventoryService.reserve([line()], reference()),
      inventoryService.reserve([line()], reference()),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);

    expect(await readCounters()).toEqual({ onHand: 1, reserved: 1 });
    expect(await inventoryService.getAvailability("bike", String(BIKE_ID), SKU)).toMatchObject({
      onHand: 1,
      reserved: 1,
      available: 0,
    });
    expect(await StockReservation.countDocuments({ status: "held" })).toBe(1);
    await expectInventoryNeverNegative();
  });

  it("lets exactly two of five simultaneous requests take 2 units out of 5", async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 5 });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => inventoryService.reserve([line({ qty: 2 })], reference())),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(3);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 4 });
    await expectInventoryNeverNegative();
  });

  it("rejects a line whose SKU has no inventory row at all", async () => {
    await expect(inventoryService.reserve([line()], reference())).rejects.toMatchObject({
      statusCode: 409,
    });
    await expectInventoryNeverNegative();
  });
});

describe("fulfillment modes that don't touch inventory", () => {
  it("reserves an on_request line with zero stock without persisting anything", async () => {
    const reserved = await inventoryService.reserve(
      [line({ fulfillmentMode: "on_request" })],
      reference(),
    );

    expect(reserved).toHaveLength(1);
    expect(reserved[0]?.heldInInventory).toBe(false);
    expect(reserved[0]?.reservationId).toBeUndefined();
    expect(await StockReservation.countDocuments()).toBe(0);
    expect(await InventoryItem.countDocuments()).toBe(0);
  });

  it("reserves a preorder line with zero stock without persisting anything", async () => {
    const reserved = await inventoryService.reserve([line({ fulfillmentMode: "preorder" })], reference());

    expect(reserved[0]?.heldInInventory).toBe(false);
    expect(await StockReservation.countDocuments()).toBe(0);
  });

  it("leaves an existing inventory row untouched for an on_request line", async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 3 });

    await inventoryService.reserve([line({ fulfillmentMode: "on_request", qty: 3 })], reference());

    expect(await readCounters()).toEqual({ onHand: 3, reserved: 0 });
  });
});

describe("multi-line reservation", () => {
  const OTHER_SKU = "BK-TARMAC-L";

  beforeEach(async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 5 });
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: OTHER_SKU, onHand: 1 });
  });

  it("holds every line when all of them fit", async () => {
    const reserved = await inventoryService.reserve(
      [line({ qty: 2 }), line({ sku: OTHER_SKU, qty: 1 })],
      reference(),
    );

    expect(reserved.every((entry) => entry.heldInInventory)).toBe(true);
    expect(await readCounters()).toMatchObject({ reserved: 2 });
    expect(await readCounters(OTHER_SKU)).toMatchObject({ reserved: 1 });
  });

  it("compensates the lines it already held when a later line has no stock", async () => {
    await expect(
      inventoryService.reserve([line({ qty: 2 }), line({ sku: OTHER_SKU, qty: 4 })], reference()),
    ).rejects.toMatchObject({ statusCode: 409 });

    // The first line was held and then given back — no partial reservation survives.
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 0 });
    expect(await readCounters(OTHER_SKU)).toEqual({ onHand: 1, reserved: 0 });
    expect(await StockReservation.countDocuments()).toBe(0);
    await expectInventoryNeverNegative();
  });
});

describe("atomicity across the two collections", () => {
  beforeEach(async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 5 });
  });

  /**
   * Everything below is only meaningful if the service is taking its
   * transactional path. If the test harness ever drops back to a standalone
   * mongod, the service silently switches to compensating writes and these
   * assertions would pass for the wrong reason — so assert the path first.
   */
  it("runs against a deployment that supports transactions", async () => {
    expect(await supportsTransactions()).toBe(true);
  });

  it("rolls the counter back when the reservation document cannot be written", async () => {
    // Fails *after* `reserved` was already incremented — the exact window a
    // crash used to leak. Compensation is deliberately skipped on the
    // transactional path, so the counter can only come back if the abort did
    // it.
    vi.spyOn(StockReservation, "create").mockRejectedValueOnce(new Error("boom"));

    await expect(inventoryService.reserve([line({ qty: 2 })], reference())).rejects.toThrow("boom");

    expect(await readCounters()).toEqual({ onHand: 5, reserved: 0 });
    expect(await StockReservation.countDocuments()).toBe(0);
    await expectInventoryNeverNegative();
  });

  it("keeps the increment invisible to everyone else until the transaction commits", async () => {
    // The distinguishing test: compensating writes would make the increment
    // visible to other requests for the duration of the hold and only undo it
    // afterwards. A real transaction never exposes it at all. Reading without
    // a session is exactly what a concurrent request does.
    let seenByOthers: number | undefined;

    vi.spyOn(StockReservation, "create").mockImplementationOnce(async () => {
      const outside = await InventoryItem.findOne({ itemType: "bike", itemId: BIKE_ID, sku: SKU }).exec();
      seenByOthers = outside?.reserved;
      throw new Error("boom");
    });

    await expect(inventoryService.reserve([line({ qty: 2 })], reference())).rejects.toThrow("boom");

    expect(seenByOthers).toBe(0);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 0 });
  });

  it("leaves no reservation document behind when a later line fails", async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: "BK-TARMAC-L", onHand: 0 });

    await expect(
      inventoryService.reserve([line({ qty: 1 }), line({ sku: "BK-TARMAC-L", qty: 1 })], reference()),
    ).rejects.toMatchObject({ statusCode: 409 });

    // The first line's document was created and then rolled back with it.
    expect(await StockReservation.countDocuments()).toBe(0);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 0 });
  });
});

describe("release", () => {
  beforeEach(async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 5 });
  });

  it("gives the held units back and is idempotent", async () => {
    const ref = reference();
    await inventoryService.reserve([line({ qty: 3 })], ref);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 3 });

    expect(await inventoryService.release(ref)).toBe(1);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 0 });

    // Calling it again releases nothing — the second call finds no `held` doc
    // to claim, so the counter is never decremented twice.
    expect(await inventoryService.release(ref)).toBe(0);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 0 });
  });

  it("marks the reservation released and stamps it for TTL retention", async () => {
    const ref = reference();
    await inventoryService.reserve([line()], ref);

    await inventoryService.release(ref);

    const reservation = await StockReservation.findOne({ referenceId: ref.referenceId }).exec();
    expect(reservation?.status).toBe("released");
    expect(reservation?.releasedAt).toBeInstanceOf(Date);
    expect(reservation?.purgeAt).toBeInstanceOf(Date);
  });

  it("does not release another reference's reservation", async () => {
    const mine = reference();
    const someoneElse = reference();
    await inventoryService.reserve([line()], mine);
    await inventoryService.reserve([line()], someoneElse);

    expect(await inventoryService.release(mine)).toBe(1);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 1 });
  });

  it("survives two simultaneous releases of the same reservation", async () => {
    const ref = reference();
    await inventoryService.reserve([line({ qty: 2 })], ref);

    const [first, second] = await Promise.all([inventoryService.release(ref), inventoryService.release(ref)]);

    expect(first + second).toBe(1);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 0 });
    await expectInventoryNeverNegative();
  });
});

describe("commit", () => {
  beforeEach(async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 5 });
  });

  it("takes the units out of physical stock and is idempotent", async () => {
    const ref = reference();
    await inventoryService.reserve([line({ qty: 2 })], ref);

    expect(await inventoryService.commit(ref)).toBe(1);
    expect(await readCounters()).toEqual({ onHand: 3, reserved: 0 });

    expect(await inventoryService.commit(ref)).toBe(0);
    expect(await readCounters()).toEqual({ onHand: 3, reserved: 0 });
  });

  it("cannot be released after being committed", async () => {
    const ref = reference();
    await inventoryService.reserve([line({ qty: 2 })], ref);
    await inventoryService.commit(ref);

    // A late release (abandoned-checkout cleanup, expiry job) must not hand
    // back units that were already sold.
    expect(await inventoryService.release(ref)).toBe(0);
    expect(await readCounters()).toEqual({ onHand: 3, reserved: 0 });
  });

  it("survives a simultaneous commit and release", async () => {
    const ref = reference();
    await inventoryService.reserve([line({ qty: 2 })], ref);

    const [committed, released] = await Promise.all([
      inventoryService.commit(ref),
      inventoryService.release(ref),
    ]);

    expect(committed + released).toBe(1);
    await expectInventoryNeverNegative();
  });
});
