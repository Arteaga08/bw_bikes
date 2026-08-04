import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startReservationReaper, stopReservationReaper } from "../src/jobs/index.js";
import { AuditLog, InventoryItem, StockReservation } from "../src/models/index.js";
import { inventoryService } from "../src/services/inventory.service.js";
import { createInventoryItemDoc } from "./helpers/factories.js";

const BIKE_ID = new Types.ObjectId();
const SKU = "BK-EXPIRE-M";

function line(qty = 1) {
  return {
    itemType: "bike" as const,
    itemId: String(BIKE_ID),
    sku: SKU,
    qty,
    fulfillmentMode: "in_stock" as const,
  };
}

function reference(id = new Types.ObjectId()) {
  return { referenceType: "order" as const, referenceId: String(id) };
}

async function readCounters() {
  const item = await InventoryItem.findOne({ itemType: "bike", itemId: BIKE_ID, sku: SKU }).exec();
  return { onHand: item?.onHand ?? 0, reserved: item?.reserved ?? 0 };
}

/** Backdates a hold so it is already past its deadline, without waiting on a real clock. */
async function expireReservationsOf(ref: { referenceId: string }): Promise<void> {
  await StockReservation.updateMany(
    { referenceId: ref.referenceId },
    { $set: { expiresAt: new Date(Date.now() - 60_000) } },
  ).exec();
}

describe("expired reservations are released on their own", () => {
  beforeEach(async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 5 });
  });

  it("gives the units back and marks the reservation released", async () => {
    const ref = reference();
    await inventoryService.reserve([line(3)], ref);
    await expireReservationsOf(ref);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 3 });

    const released = await inventoryService.releaseExpiredReservations();

    expect(released).toBe(1);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 0 });

    const reservation = await StockReservation.findOne({ referenceId: ref.referenceId }).exec();
    expect(reservation?.status).toBe("released");
    expect(reservation?.releasedAt).toBeInstanceOf(Date);
    // Stamped for TTL retention only now that it reached a terminal state.
    expect(reservation?.purgeAt).toBeInstanceOf(Date);
  });

  it("records the release in the audit trail as a system action", async () => {
    const ref = reference();
    await inventoryService.reserve([line()], ref);
    await expireReservationsOf(ref);

    await inventoryService.releaseExpiredReservations();

    const entry = await AuditLog.findOne({ action: "inventory.reservation_expired" }).exec();
    expect(entry).not.toBeNull();
    expect(entry?.actorType).toBe("system");
    expect(entry?.actorId).toBeUndefined();
    expect(entry?.module).toBe("inventory");
  });

  it("leaves a reservation that has not expired yet alone", async () => {
    const ref = reference();
    await inventoryService.reserve([line(2)], ref);

    expect(await inventoryService.releaseExpiredReservations()).toBe(0);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 2 });
    expect((await StockReservation.findOne({ referenceId: ref.referenceId }).exec())?.status).toBe("held");
  });

  it("never re-releases an already committed reservation", async () => {
    const ref = reference();
    await inventoryService.reserve([line(2)], ref);
    await inventoryService.commit(ref);
    // A committed hold keeps its (now past) deadline — the sweep must skip it
    // on status, not on time, or a paid order would resurrect its units.
    await expireReservationsOf(ref);

    expect(await inventoryService.releaseExpiredReservations()).toBe(0);
    expect(await readCounters()).toEqual({ onHand: 3, reserved: 0 });
  });

  it("decrements exactly once when the sweep races a manual release", async () => {
    const ref = reference();
    await inventoryService.reserve([line(2)], ref);
    await expireReservationsOf(ref);

    const [swept, released] = await Promise.all([
      inventoryService.releaseExpiredReservations(),
      inventoryService.release(ref),
    ]);

    expect(swept + released).toBe(1);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 0 });
  });

  it("releases the units of several expired reservations in one sweep", async () => {
    const first = reference();
    const second = reference();
    await inventoryService.reserve([line(2)], first);
    await inventoryService.reserve([line(1)], second);
    await expireReservationsOf(first);
    await expireReservationsOf(second);

    expect(await inventoryService.releaseExpiredReservations()).toBe(2);
    expect(await readCounters()).toEqual({ onHand: 5, reserved: 0 });
  });
});

describe("reservation reaper job", () => {
  // `RESERVATION_REAPER_INTERVAL_MS` is 50ms under test (see vitest.config.ts),
  // so this waits on a real tick rather than faking timers — which would also
  // fake the ones the Mongo driver runs on.
  async function waitFor(condition: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Condition not met before timeout");
  }

  afterEach(() => {
    stopReservationReaper();
  });

  it("releases an expired reservation without anyone asking it to", async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 2 });
    const ref = reference();
    await inventoryService.reserve([line(2)], ref);
    await expireReservationsOf(ref);

    startReservationReaper();

    await waitFor(async () => (await readCounters()).reserved === 0);
    expect(await readCounters()).toEqual({ onHand: 2, reserved: 0 });
  });

  it("stops sweeping once stopped", async () => {
    startReservationReaper();
    stopReservationReaper();

    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 2 });
    const ref = reference();
    await inventoryService.reserve([line(1)], ref);
    await expireReservationsOf(ref);

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(await readCounters()).toEqual({ onHand: 2, reserved: 1 });
  });
});

describe("TTL index", () => {
  it("expires on purgeAt and never on expiresAt", async () => {
    // Deleting a *held* reservation would erase the only record of how many
    // units to give back, stranding `reserved` forever. So the TTL is on
    // `purgeAt`, which is written only on a terminal transition, and the sweep
    // above is what actually releases stock.
    const indexes = await StockReservation.collection.indexes();

    const ttlIndexes = indexes.filter((index) => index["expireAfterSeconds"] !== undefined);
    expect(ttlIndexes).toHaveLength(1);
    expect(ttlIndexes[0]?.key).toEqual({ purgeAt: 1 });
    expect(ttlIndexes[0]?.["expireAfterSeconds"]).toBe(0);
  });

  it("leaves purgeAt unset while the reservation is held", async () => {
    await createInventoryItemDoc({ itemId: BIKE_ID, sku: SKU, onHand: 1 });
    const ref = reference();

    await inventoryService.reserve([line()], ref);

    const reservation = await StockReservation.findOne({ referenceId: ref.referenceId }).exec();
    expect(reservation?.status).toBe("held");
    expect(reservation?.purgeAt).toBeUndefined();
  });
});
