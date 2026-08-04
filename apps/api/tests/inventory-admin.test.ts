import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AuditLog, InventoryItem } from "../src/models/index.js";
import { inventoryService } from "../src/services/inventory.service.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { seedBikeWithVariant } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

describe("inventory administration", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let itemId: string;
  let sku: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    ({ itemId, sku } = await seedBikeWithVariant({ sku: "BK-ADMIN-M" }));
  });

  async function createRow(overrides: Record<string, unknown> = {}) {
    return request(app)
      .post(`${ADMIN}/inventory`)
      .set("Cookie", adminCookie)
      .send({ itemType: "bike", itemId, sku, onHand: 4, ...overrides });
  }

  it("creates a row, reads it back and reports availability", async () => {
    const created = await createRow();

    expect(created.status).toBe(201);
    expect(created.body.data.item).toMatchObject({ sku, onHand: 4, reserved: 0, available: 4 });

    const id = created.body.data.item.id as string;
    const read = await request(app).get(`${ADMIN}/inventory/${id}`).set("Cookie", adminCookie);

    expect(read.status).toBe(200);
    expect(read.body.data.item.available).toBe(4);
  });

  it("rejects a SKU that no variant of that product declares", async () => {
    const response = await createRow({ sku: "BK-NO-EXISTE" });

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("SKU");
    expect(await InventoryItem.countDocuments()).toBe(0);
  });

  it("rejects a product that does not exist", async () => {
    const response = await createRow({ itemId: String(new Types.ObjectId()) });

    expect(response.status).toBe(404);
  });

  it("rejects a SKU that belongs to the other catalog's product", async () => {
    // The triplet is validated against the collection `itemType` names, so a
    // bike SKU declared as an accessory must not resolve.
    const response = await createRow({ itemType: "accessory" });

    expect(response.status).toBe(404);
  });

  it("rejects a duplicate row for the same variant with 409", async () => {
    await createRow();

    const duplicate = await createRow();

    expect(duplicate.status).toBe(409);
    expect(await InventoryItem.countDocuments()).toBe(1);
  });

  it("ignores a reserved value injected in the create payload", async () => {
    const response = await createRow({ reserved: 99 });

    expect(response.status).toBe(201);
    // Verified against the DB: `stripUnknown` dropped it, so the schema default
    // won. Only a real reservation may ever move this counter.
    const stored = await InventoryItem.findById(response.body.data.item.id).exec();
    expect(stored?.reserved).toBe(0);
  });

  it("rejects a fractional stock count", async () => {
    const response = await createRow({ onHand: 4.5 });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("entero");
  });
});

describe("stock adjustments", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let rowId: string;
  let itemId: string;
  let sku: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    ({ itemId, sku } = await seedBikeWithVariant({ sku: "BK-ADJUST-M" }));

    const created = await request(app)
      .post(`${ADMIN}/inventory`)
      .set("Cookie", adminCookie)
      .send({ itemType: "bike", itemId, sku, onHand: 5 });
    rowId = created.body.data.item.id as string;
  });

  function adjust(payload: Record<string, unknown>) {
    return request(app).patch(`${ADMIN}/inventory/${rowId}/stock`).set("Cookie", adminCookie).send(payload);
  }

  it("overwrites the count with onHand", async () => {
    const response = await adjust({ onHand: 12, reason: "Recuento físico" });

    expect(response.status).toBe(200);
    expect(response.body.data.item).toMatchObject({ onHand: 12, available: 12 });
  });

  it("adds to the count with delta", async () => {
    expect((await adjust({ delta: 3 })).body.data.item.onHand).toBe(8);
    expect((await adjust({ delta: -2 })).body.data.item.onHand).toBe(6);
  });

  it("refuses to leave physical stock below what is already reserved", async () => {
    await inventoryService.reserve(
      [{ itemType: "bike", itemId, sku, qty: 4, fulfillmentMode: "in_stock" }],
      { referenceType: "order", referenceId: String(new Types.ObjectId()) },
    );

    const response = await adjust({ onHand: 2 });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("4 unidades ya reservadas");

    const stored = await InventoryItem.findById(rowId).exec();
    expect(stored?.onHand).toBe(5);
  });

  it("refuses a delta that would go below what is reserved", async () => {
    await inventoryService.reserve(
      [{ itemType: "bike", itemId, sku, qty: 5, fulfillmentMode: "in_stock" }],
      { referenceType: "order", referenceId: String(new Types.ObjectId()) },
    );

    expect((await adjust({ delta: -1 })).status).toBe(409);
    expect((await InventoryItem.findById(rowId).exec())?.onHand).toBe(5);
  });

  it("rejects sending both onHand and delta, or neither", async () => {
    expect((await adjust({ onHand: 3, delta: 1 })).status).toBe(400);
    expect((await adjust({})).status).toBe(400);
    expect((await adjust({ delta: 0 })).status).toBe(400);
  });

  it("records every adjustment in the audit trail", async () => {
    await adjust({ delta: 2, reason: "Recepción de embarque" });

    const entry = await AuditLog.findOne({ action: "inventory.stock_adjusted" }).exec();
    expect(entry).not.toBeNull();
    expect(entry?.actorType).toBe("user");
    expect(entry?.before).toMatchObject({ onHand: 5 });
    expect(entry?.after).toMatchObject({ onHand: 7, reason: "Recepción de embarque" });
  });

  it("records the creation in the audit trail", async () => {
    const entry = await AuditLog.findOne({ action: "inventory.item_created" }).exec();
    expect(entry).not.toBeNull();
    expect(entry?.actorType).toBe("user");
  });
});

describe("inventory listing", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);

    const { itemId } = await seedBikeWithVariant({ sku: "BK-LIST-M" });
    await InventoryItem.insertMany(
      Array.from({ length: 25 }, (_, index) => ({
        itemType: "bike",
        itemId,
        sku: `BK-LIST-${String(index).padStart(3, "0")}`,
        onHand: index,
      })),
    );
  });

  it("paginates with correct meta", async () => {
    const response = await request(app)
      .get(`${ADMIN}/inventory?page=2&limit=10`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ total: 25, page: 2, pages: 3, limit: 10 });
    expect(response.body.data.items).toHaveLength(10);
  });

  it("searches by SKU", async () => {
    const response = await request(app)
      .get(`${ADMIN}/inventory?search=LIST-007`)
      .set("Cookie", adminCookie);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].sku).toBe("BK-LIST-007");
  });

  it("rejects an unsupported sort field", async () => {
    const response = await request(app).get(`${ADMIN}/inventory?sort=reserved`).set("Cookie", adminCookie);

    expect(response.status).toBe(400);
  });
});

describe("inventory authorization", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  it("rejects an anonymous request with 401", async () => {
    expect((await request(app).get(`${ADMIN}/inventory`)).status).toBe(401);
  });

  it("rejects an authenticated customer with 403", async () => {
    const customerCookie = await createCustomerSession(app);

    const response = await request(app).get(`${ADMIN}/inventory`).set("Cookie", customerCookie);

    expect(response.status).toBe(403);
  });

  it("rejects a customer trying to adjust stock with 403", async () => {
    const customerCookie = await createCustomerSession(app);

    const response = await request(app)
      .patch(`${ADMIN}/inventory/${new Types.ObjectId()}/stock`)
      .set("Cookie", customerCookie)
      .send({ delta: 100 });

    expect(response.status).toBe(403);
  });
});
