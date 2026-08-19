import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AuditLog, InventoryItem } from "../src/models/index.js";
import { inventoryService, type InitialStockVariant } from "../src/services/inventory.service.js";
import { withOptionalTransaction } from "../src/utils/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc, createInventoryItemDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

type App = ReturnType<typeof buildApp>;

describe("seedInitialStock — transactional atomicity", () => {
  // This is the one genuinely reachable failure this milestone's atomicity
  // guarantee protects against: a mid-loop write failing after an earlier
  // one in the same call already landed. Exercised directly against the
  // service rather than through `POST /admin/bikes`, because the natural
  // duplicate-key failure this guards against — two variants of the same
  // create payload resolving to the same `{itemType, itemId, sku}` — can't
  // actually occur end-to-end: `assertVariantSkusAreUnique` already refuses
  // duplicate SKUs within one product's own variants before the transaction
  // ever starts, and `itemId` is a brand-new id nothing else could reference.
  // The guarantee is real defense-in-depth; this proves the mechanism works
  // without faking a scenario the API itself would never let through.
  it("rolls back every row seeded in the call when a later one collides", async () => {
    // This is the first test in the file to touch `InventoryItem`, on a
    // fresh per-file `MongoMemoryReplSet` — without this, the collision
    // below can race ahead of Mongoose's background index build and the
    // unique index wouldn't be enforced yet, making the assertion flaky.
    await InventoryItem.init();

    const itemId = new Types.ObjectId();
    await createInventoryItemDoc({ itemType: "bike", itemId, sku: "BK-ROLLBACK-B", onHand: 1 });

    const variants: InitialStockVariant[] = [
      { sku: "BK-ROLLBACK-A", fulfillmentMode: "in_stock", initialStock: 5 },
      { sku: "BK-ROLLBACK-B", fulfillmentMode: "in_stock", initialStock: 5 },
    ];

    await expect(
      withOptionalTransaction((session) => inventoryService.seedInitialStock("bike", itemId, variants, session)),
    ).rejects.toThrow();

    const rowA = await InventoryItem.findOne({ itemType: "bike", itemId, sku: "BK-ROLLBACK-A" }).exec();
    expect(rowA).toBeNull();
  });
});

describe("initial stock captured at product creation", () => {
  let app: App;
  let adminCookie: string;
  let categoryId: string;
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const [category, brand] = await Promise.all([createBikeCategoryDoc(), createBrandDoc()]);
    categoryId = String(category._id);
    brandId = String(brand._id);
  });

  function createBike(variants: Record<string, unknown>[]) {
    return request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send({
        name: "Bici con stock inicial",
        brand: brandId,
        category: categoryId,
        shortDescription: "x",
        description: "x",
        price: 20_000_00,
        variants,
      });
  }

  it("creates one InventoryItem per in_stock variant with the declared onHand", async () => {
    const res = await createBike([
      { sku: "BK-INIT-S", size: "S", fulfillmentMode: "in_stock", initialStock: 3 },
      { sku: "BK-INIT-M", size: "M", fulfillmentMode: "in_stock", initialStock: 7 },
      { sku: "BK-INIT-L", size: "L", fulfillmentMode: "in_stock", initialStock: 2 },
    ]);

    expect(res.status).toBe(201);
    const bikeId = res.body.data.bike.id as string;

    const rows = await InventoryItem.find({ itemType: "bike", itemId: bikeId }).sort({ sku: 1 }).exec();
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => ({ sku: row.sku, onHand: row.onHand }))).toEqual([
      { sku: "BK-INIT-L", onHand: 2 },
      { sku: "BK-INIT-M", onHand: 7 },
      { sku: "BK-INIT-S", onHand: 3 },
    ]);

    const entries = await AuditLog.find({ action: "inventory.item_created" }).exec();
    expect(entries).toHaveLength(3);
  });

  it("does not seed a row for an on_request or preorder variant, even with initialStock present", async () => {
    const res = await createBike([
      { sku: "BK-INIT-REQ", size: "M", fulfillmentMode: "on_request", initialStock: 10 },
      { sku: "BK-INIT-PRE", size: "M", fulfillmentMode: "preorder", initialStock: 10 },
    ]);

    expect(res.status).toBe(201);
    const bikeId = res.body.data.bike.id as string;

    const rows = await InventoryItem.find({ itemType: "bike", itemId: bikeId }).exec();
    expect(rows).toHaveLength(0);
  });

  it("does not seed a row when initialStock is 0 or absent", async () => {
    const res = await createBike([
      { sku: "BK-INIT-ZERO", size: "M", fulfillmentMode: "in_stock", initialStock: 0 },
      { sku: "BK-INIT-NONE", size: "L", fulfillmentMode: "in_stock" },
    ]);

    expect(res.status).toBe(201);
    const bikeId = res.body.data.bike.id as string;

    const rows = await InventoryItem.find({ itemType: "bike", itemId: bikeId }).exec();
    expect(rows).toHaveLength(0);
  });

  it("rejects an initialStock above the physical stock ceiling", async () => {
    const res = await createBike([{ sku: "BK-INIT-HUGE", size: "M", fulfillmentMode: "in_stock", initialStock: 5_000_000 }]);
    expect(res.status).toBe(400);
  });

  it("is silently dropped on an update payload — stock capture only happens once, at creation", async () => {
    const created = await createBike([{ sku: "BK-INIT-EDIT", size: "M", fulfillmentMode: "in_stock", initialStock: 4 }]);
    const bikeId = created.body.data.bike.id as string;

    const update = await request(app)
      .patch(`${ADMIN}/bikes/${bikeId}`)
      .set("Cookie", adminCookie)
      .send({ variants: [{ sku: "BK-INIT-EDIT", size: "M", fulfillmentMode: "in_stock", initialStock: 999 }] });

    expect(update.status).toBe(200);

    const row = await InventoryItem.findOne({ itemType: "bike", itemId: bikeId, sku: "BK-INIT-EDIT" }).exec();
    // Untouched by the edit — still the value seeded at creation, not 999.
    expect(row?.onHand).toBe(4);
  });

  it("seeds an InventoryItem for a brand-new variant added on a PATCH, leaving the original variant's stock untouched", async () => {
    const created = await createBike([{ sku: "BK-INIT-ORIG", size: "M", fulfillmentMode: "in_stock", initialStock: 4 }]);
    const bikeId = created.body.data.bike.id as string;

    const update = await request(app)
      .patch(`${ADMIN}/bikes/${bikeId}`)
      .set("Cookie", adminCookie)
      .send({
        variants: [
          { sku: "BK-INIT-ORIG", size: "M", fulfillmentMode: "in_stock", initialStock: 999 },
          { sku: "BK-INIT-NEW", size: "L", fulfillmentMode: "in_stock", initialStock: 5 },
        ],
      });

    expect(update.status).toBe(200);

    const originalRow = await InventoryItem.findOne({ itemType: "bike", itemId: bikeId, sku: "BK-INIT-ORIG" }).exec();
    expect(originalRow?.onHand).toBe(4);

    const newRow = await InventoryItem.findOne({ itemType: "bike", itemId: bikeId, sku: "BK-INIT-NEW" }).exec();
    expect(newRow?.onHand).toBe(5);

    const entries = await AuditLog.find({ action: "inventory.item_created" }).exec();
    expect(entries.map((entry) => (entry.after as { sku?: string })?.sku)).toContain("BK-INIT-NEW");
  });

  it("rolls back the whole PATCH — variants included — when seeding a new variant's stock collides with an existing InventoryItem row for the same product", async () => {
    await InventoryItem.init();

    const created = await createBike([{ sku: "BK-INIT-KEEP", size: "M", fulfillmentMode: "in_stock", initialStock: 1 }]);
    const bikeId = created.body.data.bike.id as string;

    // A stray row for this exact bike + SKU already exists (e.g. left over
    // from a manual "Registrar entrada") — `seedInitialStock`'s `create()`
    // for the same {itemType, itemId, sku} triple must collide with it.
    await createInventoryItemDoc({ itemType: "bike", itemId: new Types.ObjectId(bikeId), sku: "BK-INIT-COLLIDE", onHand: 1 });

    const update = await request(app)
      .patch(`${ADMIN}/bikes/${bikeId}`)
      .set("Cookie", adminCookie)
      .send({
        variants: [
          { sku: "BK-INIT-KEEP", size: "M", fulfillmentMode: "in_stock", initialStock: 1 },
          { sku: "BK-INIT-COLLIDE", size: "L", fulfillmentMode: "in_stock", initialStock: 3 },
        ],
      });

    // The global error handler maps the underlying Mongo duplicate-key error
    // (11000) to a 409 — what matters here is that it's an error at all, and
    // that the product write rolled back with it (asserted below), not the
    // exact status code.
    expect(update.status).toBe(409);

    const bikeGet = await request(app).get(`${ADMIN}/bikes/${bikeId}`).set("Cookie", adminCookie);
    const skus = (bikeGet.body.data.bike.variants as { sku: string }[]).map((v) => v.sku);
    expect(skus).toEqual(["BK-INIT-KEEP"]);
  });
});

describe("initial stock — accessories", () => {
  let app: App;
  let adminCookie: string;
  let categoryId: string;
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const brand = await createBrandDoc();
    const category = await (await import("../src/models/index.js")).AccessoryCategory.create({
      name: "Cascos",
      slug: `cascos-${Math.random().toString(16).slice(2, 8)}`,
      isActive: true,
    });
    categoryId = String(category._id);
    brandId = String(brand._id);
  });

  it("seeds initial stock for an accessory the same way it does for a bike", async () => {
    const res = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send({
        name: "Casco con stock",
        brand: brandId,
        category: categoryId,
        description: "x",
        price: 1_500_00,
        variants: [{ sku: "AC-INIT-U", size: "U", fulfillmentMode: "in_stock", initialStock: 6 }],
      });

    expect(res.status).toBe(201);
    const accessoryId = res.body.data.accessory.id as string;

    const row = await InventoryItem.findOne({ itemType: "accessory", itemId: accessoryId, sku: "AC-INIT-U" }).exec();
    expect(row?.onHand).toBe(6);
  });

  it("seeds an InventoryItem for a brand-new accessory variant added on a PATCH", async () => {
    const created = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send({
        name: "Casco con stock",
        brand: brandId,
        category: categoryId,
        description: "x",
        price: 1_500_00,
        variants: [{ sku: "AC-INIT-ORIG", size: "U", fulfillmentMode: "in_stock", initialStock: 2 }],
      });
    const accessoryId = created.body.data.accessory.id as string;

    const update = await request(app)
      .patch(`${ADMIN}/accessories/${accessoryId}`)
      .set("Cookie", adminCookie)
      .send({
        variants: [
          { sku: "AC-INIT-ORIG", size: "U", fulfillmentMode: "in_stock", initialStock: 999 },
          { sku: "AC-INIT-NEW", size: "L", fulfillmentMode: "in_stock", initialStock: 8 },
        ],
      });

    expect(update.status).toBe(200);

    const originalRow = await InventoryItem.findOne({ itemType: "accessory", itemId: accessoryId, sku: "AC-INIT-ORIG" }).exec();
    expect(originalRow?.onHand).toBe(2);

    const newRow = await InventoryItem.findOne({ itemType: "accessory", itemId: accessoryId, sku: "AC-INIT-NEW" }).exec();
    expect(newRow?.onHand).toBe(8);
  });
});
