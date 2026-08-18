import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Bike, BikeCategory, type IBike } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc, seedBikeWithVariant } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

type App = ReturnType<typeof buildApp>;

describe("inventory admin list — enriched DTO", () => {
  let app: App;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  async function createRow(itemId: string, sku: string, overrides: Record<string, unknown> = {}) {
    return request(app)
      .post(`${ADMIN}/inventory`)
      .set("Cookie", adminCookie)
      .send({ itemType: "bike", itemId, sku, onHand: 10, ...overrides });
  }

  it("joins product name, brand and variant details onto each row", async () => {
    const { itemId, sku } = await seedBikeWithVariant({ sku: "BK-ENRICH-M", brandName: "Trek" });
    const created = await createRow(itemId, sku);
    expect(created.status).toBe(201);

    const list = await request(app).get(`${ADMIN}/inventory?itemId=${itemId}`).set("Cookie", adminCookie);

    expect(list.status).toBe(200);
    const [row] = list.body.data.items as {
      product: { name: string; brand: string } | null;
      variant: { size?: string; fulfillmentMode: string } | null;
    }[];
    expect(row!.product?.brand).toBe("Trek");
    expect(row!.variant).toMatchObject({ size: "M", fulfillmentMode: "in_stock" });
  });

  it("reports product and variant as null once the product is deleted", async () => {
    const { bike, itemId, sku } = await seedBikeWithVariant({ sku: "BK-GONE-M" });
    await createRow(itemId, sku);

    await Bike.findByIdAndDelete(bike._id).exec();

    const list = await request(app).get(`${ADMIN}/inventory?itemId=${itemId}`).set("Cookie", adminCookie);
    const [row] = list.body.data.items as { product: unknown; variant: unknown }[];
    expect(row!.product).toBeNull();
    expect(row!.variant).toBeNull();
  });

  it("marks a variant whose SKU was renamed away as variant: null, while product stays resolved", async () => {
    const { bike, itemId, sku } = await seedBikeWithVariant({ sku: "BK-RENAMED-M" });
    await createRow(itemId, sku);

    bike.variants = [{ ...bike.variants[0]!, sku: "BK-RENAMED-M-V2" }];
    await bike.save();

    const list = await request(app).get(`${ADMIN}/inventory?itemId=${itemId}`).set("Cookie", adminCookie);
    const [row] = list.body.data.items as { product: unknown; variant: unknown }[];
    expect(row!.product).not.toBeNull();
    expect(row!.variant).toBeNull();
  });
});

describe("inventory admin list — stock filter and threshold override", () => {
  let app: App;
  let adminCookie: string;
  let itemId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    ({ itemId } = await seedBikeWithVariant({ sku: "BK-THRESH-BASE" }));
  });

  async function createRow(sku: string, onHand: number, lowStockThreshold?: number) {
    // Each row needs its own real variant, so point every SKU at the same
    // product but declare a matching entry in its variant array too.
    return request(app)
      .post(`${ADMIN}/inventory`)
      .set("Cookie", adminCookie)
      .send({
        itemType: "bike",
        itemId,
        sku,
        onHand,
        ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}),
      });
  }

  it("classifies out/low/healthy at the exact boundary of the global default (5)", async () => {
    const bike = await Bike.findById(itemId).exec();
    bike!.variants.push(
      { sku: "BK-THRESH-OUT", size: "S", fulfillmentMode: "in_stock", isActive: true },
      { sku: "BK-THRESH-EDGE", size: "M", fulfillmentMode: "in_stock", isActive: true },
      { sku: "BK-THRESH-OVER", size: "L", fulfillmentMode: "in_stock", isActive: true },
    );
    await bike!.save();

    await createRow("BK-THRESH-OUT", 0); // available = 0 → out
    await createRow("BK-THRESH-EDGE", 5); // available = 5 = default threshold → low
    await createRow("BK-THRESH-OVER", 6); // available = 6 > default threshold → healthy

    const out = await request(app).get(`${ADMIN}/inventory?itemId=${itemId}&stock=out`).set("Cookie", adminCookie);
    expect((out.body.data.items as { sku: string }[]).map((i) => i.sku)).toEqual(["BK-THRESH-OUT"]);

    const low = await request(app).get(`${ADMIN}/inventory?itemId=${itemId}&stock=low`).set("Cookie", adminCookie);
    expect((low.body.data.items as { sku: string }[]).map((i) => i.sku)).toEqual(["BK-THRESH-EDGE"]);
  });

  it("a per-SKU lowStockThreshold override wins over the store-wide default", async () => {
    const bike = await Bike.findById(itemId).exec();
    bike!.variants.push({ sku: "BK-THRESH-OVERRIDE", size: "S", fulfillmentMode: "in_stock", isActive: true });
    await bike!.save();

    // 8 units is healthy under the default (5) but the row declares its own
    // threshold of 10 — it should surface as low regardless of the default.
    await createRow("BK-THRESH-OVERRIDE", 8, 10);

    const low = await request(app).get(`${ADMIN}/inventory?itemId=${itemId}&stock=low`).set("Cookie", adminCookie);
    expect((low.body.data.items as { sku: string }[]).map((i) => i.sku)).toContain("BK-THRESH-OVERRIDE");

    const [row] = (await request(app).get(`${ADMIN}/inventory?itemId=${itemId}&search=OVERRIDE`).set("Cookie", adminCookie))
      .body.data.items as { lowStockThresholdUnits: number }[];
    expect(row!.lowStockThresholdUnits).toBe(10);
  });
});

describe("inventory admin list — category filter", () => {
  let app: App;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  it("filtering by a root category includes SKUs from its child categories", async () => {
    const root = await createBikeCategoryDoc({ name: "Ruta" });
    const child = await BikeCategory.create({ name: "Ruta Aero", slug: "ruta-aero", parent: root._id });
    const otherRoot = await createBikeCategoryDoc({ name: "Montaña" });
    const brand = await createBrandDoc();

    const inChild: IBike = await Bike.create({
      name: "Bici en hija",
      slug: "bici-en-hija",
      brand: brand._id,
      category: child._id,
      shortDescription: "x",
      description: "x",
      price: 1_000_00,
      variants: [{ sku: "BK-CAT-CHILD", size: "M", fulfillmentMode: "in_stock", isActive: true }],
    });
    const inOtherRoot: IBike = await Bike.create({
      name: "Bici en otra raíz",
      slug: "bici-en-otra-raiz",
      brand: brand._id,
      category: otherRoot._id,
      shortDescription: "x",
      description: "x",
      price: 1_000_00,
      variants: [{ sku: "BK-CAT-OTHER", size: "M", fulfillmentMode: "in_stock", isActive: true }],
    });

    await request(app)
      .post(`${ADMIN}/inventory`)
      .set("Cookie", adminCookie)
      .send({ itemType: "bike", itemId: String(inChild._id), sku: "BK-CAT-CHILD", onHand: 5 });
    await request(app)
      .post(`${ADMIN}/inventory`)
      .set("Cookie", adminCookie)
      .send({ itemType: "bike", itemId: String(inOtherRoot._id), sku: "BK-CAT-OTHER", onHand: 5 });

    const res = await request(app)
      .get(`${ADMIN}/inventory?itemType=bike&category=${String(root._id)}`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    const skus = (res.body.data.items as { sku: string }[]).map((item) => item.sku);
    expect(skus).toContain("BK-CAT-CHILD");
    expect(skus).not.toContain("BK-CAT-OTHER");
  });

  it("rejects a category filter without itemType — the id alone doesn't say which tree", async () => {
    const res = await request(app).get(`${ADMIN}/inventory?category=${new Types.ObjectId()}`).set("Cookie", adminCookie);
    expect(res.status).toBe(400);
  });
});

describe("inventory admin list — lastRestockedAt", () => {
  let app: App;
  let adminCookie: string;
  let rowId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const { itemId, sku } = await seedBikeWithVariant({ sku: "BK-RESTOCK-M" });
    const created = await request(app)
      .post(`${ADMIN}/inventory`)
      .set("Cookie", adminCookie)
      .send({ itemType: "bike", itemId, sku, onHand: 5 });
    rowId = created.body.data.item.id as string;
  });

  it("is absent until the first positive adjustment", async () => {
    const item = await request(app).get(`${ADMIN}/inventory/${rowId}`).set("Cookie", adminCookie);
    expect(item.body.data.item.lastRestockedAt).toBeUndefined();
  });

  it("is set by a positive delta", async () => {
    await request(app).patch(`${ADMIN}/inventory/${rowId}/stock`).set("Cookie", adminCookie).send({ delta: 3 });

    const item = await request(app).get(`${ADMIN}/inventory/${rowId}`).set("Cookie", adminCookie);
    expect(item.body.data.item.lastRestockedAt).toBeDefined();
  });

  it("is not set by a negative delta", async () => {
    await request(app).patch(`${ADMIN}/inventory/${rowId}/stock`).set("Cookie", adminCookie).send({ delta: -2 });

    const item = await request(app).get(`${ADMIN}/inventory/${rowId}`).set("Cookie", adminCookie);
    expect(item.body.data.item.lastRestockedAt).toBeUndefined();
  });
});
