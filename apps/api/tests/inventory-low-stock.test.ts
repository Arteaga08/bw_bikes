import { describe, expect, it } from "vitest";
import { InventoryItem } from "../src/models/index.js";
import { inventoryMaintenanceService } from "../src/services/inventory-maintenance.service.js";
import { createInventoryItemDoc } from "./helpers/factories.js";
import { captureNextAdminAlertEmail } from "./helpers/mailer.js";
import { captureNextAdminNotification } from "./helpers/notifier.js";

/**
 * Drives `inventoryMaintenanceService.sweepLowStock` directly with an
 * explicit clock — same style `order-authorization.test.ts` uses for
 * `orderMaintenanceService.sweepAuthorizations` — rather than over HTTP,
 * since there is no admin-triggered endpoint for this: it only ever runs on
 * `low-stock-alert.job.ts`'s timer. The store-wide threshold defaults to 5
 * units (`DEFAULT_LOW_STOCK_THRESHOLD_UNITS`) whenever a test doesn't touch
 * `Settings.inventory`.
 */
describe("low-stock sweep", () => {
  it("alerts on both Telegram and email the first time a SKU crosses at or below its threshold", async () => {
    const item = await createInventoryItemDoc({ sku: "BK-LOW-1", onHand: 3, reserved: 0 });
    const notification = captureNextAdminNotification();
    const email = captureNextAdminAlertEmail();

    const result = await inventoryMaintenanceService.sweepLowStock(new Date());

    expect(result.alerted).toBe(1);
    expect(notification.getNotification()).toMatchObject({
      kind: "inventory.low_stock",
      meta: { sku: "BK-LOW-1", available: 3, threshold: 5 },
    });
    expect(email.getParams()).toMatchObject({ subject: expect.stringContaining("BK-LOW-1") });

    const updated = await InventoryItem.findById(item._id).exec();
    expect(updated?.lowStockAlertedAt).toBeTruthy();
  });

  it("alerts on zero stock too — unlike the admin panel's low-stock bucket, which excludes it", async () => {
    await createInventoryItemDoc({ sku: "BK-LOW-2", onHand: 0, reserved: 0 });

    const result = await inventoryMaintenanceService.sweepLowStock(new Date());

    expect(result.alerted).toBe(1);
  });

  it("does not alert a SKU comfortably above its threshold", async () => {
    await createInventoryItemDoc({ sku: "BK-LOW-3", onHand: 20, reserved: 0 });

    const result = await inventoryMaintenanceService.sweepLowStock(new Date());

    expect(result.alerted).toBe(0);
  });

  it("does not alert the same crossing twice", async () => {
    await createInventoryItemDoc({ sku: "BK-LOW-4", onHand: 2, reserved: 0 });

    const first = await inventoryMaintenanceService.sweepLowStock(new Date());
    const second = await inventoryMaintenanceService.sweepLowStock(new Date());

    expect(first.alerted).toBe(1);
    expect(second.alerted).toBe(0);
  });

  it("clears the flag once stock recovers above the threshold, so a later dip alerts again", async () => {
    const item = await createInventoryItemDoc({ sku: "BK-LOW-5", onHand: 2, reserved: 0 });
    await inventoryMaintenanceService.sweepLowStock(new Date());
    expect((await InventoryItem.findById(item._id).exec())?.lowStockAlertedAt).toBeTruthy();

    await InventoryItem.updateOne({ _id: item._id }, { $set: { onHand: 50 } }).exec();
    const recovery = await inventoryMaintenanceService.sweepLowStock(new Date());
    expect(recovery.cleared).toBe(1);
    expect((await InventoryItem.findById(item._id).exec())?.lowStockAlertedAt).toBeUndefined();

    await InventoryItem.updateOne({ _id: item._id }, { $set: { onHand: 1 } }).exec();
    const secondAlert = await inventoryMaintenanceService.sweepLowStock(new Date());
    expect(secondAlert.alerted).toBe(1);
  });

  it("respects a SKU's own threshold override instead of the store-wide default", async () => {
    const item = await createInventoryItemDoc({ sku: "BK-LOW-6", onHand: 10, reserved: 0 });
    await InventoryItem.updateOne({ _id: item._id }, { $set: { lowStockThreshold: 15 } }).exec();

    const result = await inventoryMaintenanceService.sweepLowStock(new Date());

    expect(result.alerted).toBe(1);
  });
});
