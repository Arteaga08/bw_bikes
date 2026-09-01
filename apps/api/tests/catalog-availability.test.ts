import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { InventoryItem } from "../src/models/index.js";
import { inventoryService } from "../src/services/inventory.service.js";
import { seedBikeWithVariant } from "./helpers/factories.js";

const CATALOG = "/api/v1/catalog";

describe("public catalog availability", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  it("reports a variant with stock as available", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ sku: "BK-AVAIL-M" });
    await InventoryItem.create({ itemType: "bike", itemId, sku, onHand: 3 });

    const response = await request(app).get(`${CATALOG}/availability`).query({ itemType: "bike", itemIds: itemId });

    expect(response.status).toBe(200);
    expect(response.body.data.availability).toEqual([{ itemId, variants: [{ sku, isAvailable: true }] }]);
  });

  it("reports false once stock is adjusted down to zero", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ sku: "BK-AVAIL-ZERO" });
    const item = await InventoryItem.create({ itemType: "bike", itemId, sku, onHand: 2 });
    await inventoryService.adjustStock(String(item._id), { onHand: 0 }, { actorId: new Types.ObjectId().toString() });

    const response = await request(app).get(`${CATALOG}/availability`).query({ itemType: "bike", itemIds: itemId });

    expect(response.body.data.availability[0].variants).toEqual([{ sku, isAvailable: false }]);
  });

  it("reports on_request variants as available with no inventory row", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ sku: "BK-AVAIL-OR", fulfillmentMode: "on_request" });

    const response = await request(app).get(`${CATALOG}/availability`).query({ itemType: "bike", itemIds: itemId });

    expect(response.body.data.availability[0].variants).toEqual([{ sku, isAvailable: true }]);
  });

  it("omits an inactive variant from the array", async () => {
    const { itemId } = await seedBikeWithVariant({ sku: "BK-AVAIL-INACTIVE", variantActive: false });

    const response = await request(app).get(`${CATALOG}/availability`).query({ itemType: "bike", itemIds: itemId });

    expect(response.body.data.availability[0].variants).toEqual([]);
  });

  it("omits an archived product entirely", async () => {
    const { itemId } = await seedBikeWithVariant({ sku: "BK-AVAIL-ARCHIVED", isActive: false });

    const response = await request(app).get(`${CATALOG}/availability`).query({ itemType: "bike", itemIds: itemId });

    expect(response.body.data.availability).toEqual([]);
  });

  it("never exposes onHand, reserved or a stock count", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ sku: "BK-AVAIL-NOFIELDS" });
    await InventoryItem.create({ itemType: "bike", itemId, sku, onHand: 5 });

    const response = await request(app).get(`${CATALOG}/availability`).query({ itemType: "bike", itemIds: itemId });

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain("onHand");
    expect(raw).not.toContain("reserved");
    expect(raw).not.toContain("\"available\"");
  });

  it("rejects more than 20 ids", async () => {
    const itemIds = Array.from({ length: 21 }, () => new Types.ObjectId().toString()).join(",");

    const response = await request(app).get(`${CATALOG}/availability`).query({ itemType: "bike", itemIds });

    expect(response.status).toBe(400);
  });

  it("rejects an invalid itemType", async () => {
    const response = await request(app)
      .get(`${CATALOG}/availability`)
      .query({ itemType: "car", itemIds: new Types.ObjectId().toString() });

    expect(response.status).toBe(400);
  });

  it("works for anonymous requests", async () => {
    const { itemId } = await seedBikeWithVariant({ sku: "BK-AVAIL-ANON" });

    const response = await request(app).get(`${CATALOG}/availability`).query({ itemType: "bike", itemIds: itemId });

    expect(response.status).toBe(200);
  });
});
