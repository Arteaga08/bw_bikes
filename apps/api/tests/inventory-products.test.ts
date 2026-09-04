import type { FulfillmentMode } from "@bw-bikes/shared";
import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Bike, BikeCategory, type IBike, InventoryItem } from "../src/models/index.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

interface VariantInput {
  sku: string;
  size?: string;
  color?: string;
  fulfillmentMode?: FulfillmentMode;
  isActive?: boolean;
}

/**
 * Full control over brand/category/variants, unlike `seedBikeWithVariant`
 * (single variant, random brand/category) — this suite needs multi-variant,
 * multi-color, and pinned-brand/category products to exercise the
 * product-level rollup and its filters.
 */
async function createBikeProduct(
  overrides: {
    name?: string;
    brandId?: Types.ObjectId;
    categoryId?: Types.ObjectId;
    variants?: VariantInput[];
  } = {},
): Promise<IBike> {
  const suffix = Math.random().toString(16).slice(2, 8);
  const brandId = overrides.brandId ?? (await createBrandDoc())._id;
  const categoryId = overrides.categoryId ?? (await createBikeCategoryDoc())._id;

  return Bike.create({
    name: overrides.name ?? `Bici de prueba ${suffix}`,
    slug: `bici-prueba-${suffix}`,
    brand: brandId,
    category: categoryId,
    shortDescription: "Bici de prueba",
    description: "Descripción de prueba",
    price: 10_000_00,
    isActive: true,
    variants: (
      overrides.variants ?? [{ sku: `BK-${suffix}-M`, size: "M", fulfillmentMode: "in_stock", isActive: true }]
    ).map((variant) => ({ fulfillmentMode: "in_stock" as FulfillmentMode, isActive: true, ...variant })),
  });
}

describe("inventory products list — rollup", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  function listProducts(query: string) {
    return request(app).get(`${ADMIN}/inventory/products?itemType=bike${query}`).set("Cookie", adminCookie);
  }

  it("returns one row per product, not per SKU — variantCount and totalAvailable roll up every variant", async () => {
    const bike = await createBikeProduct({
      variants: [
        { sku: "BK-ROLLUP-M-RED", size: "M", color: "Rojo" },
        { sku: "BK-ROLLUP-L-RED", size: "L", color: "Rojo" },
        { sku: "BK-ROLLUP-M-BLU", size: "M", color: "Azul" },
      ],
    });
    await InventoryItem.insertMany([
      // Above the default low-stock threshold (5) — this test asserts the
      // rollup math, not the low-stock boundary, which has its own test.
      { itemType: "bike", itemId: bike._id, sku: "BK-ROLLUP-M-RED", onHand: 40 },
      { itemType: "bike", itemId: bike._id, sku: "BK-ROLLUP-L-RED", onHand: 30 },
      { itemType: "bike", itemId: bike._id, sku: "BK-ROLLUP-M-BLU", onHand: 50 },
    ]);

    const response = await listProducts("");

    expect(response.status).toBe(200);
    expect(response.body.data.products).toHaveLength(1);
    const row = response.body.data.products[0];
    expect(row).toMatchObject({
      itemId: String(bike._id),
      variantCount: 3,
      untrackedVariantCount: 0,
      totalAvailable: 120,
      totalOnHand: 120,
      totalReserved: 0,
      status: "ok",
    });
  });

  it("search matches the product name", async () => {
    await createBikeProduct({ name: "Tarmac Ultravioleta Único" });
    await createBikeProduct({ name: "Otra bici cualquiera" });

    const response = await listProducts("&search=Ultravioleta");

    expect(response.body.data.products).toHaveLength(1);
    expect(response.body.data.products[0].name).toBe("Tarmac Ultravioleta Único");
  });

  it("search matches the brand name", async () => {
    const brand = await createBrandDoc({ name: "Marca Buscable Única" });
    await createBikeProduct({ brandId: brand._id });
    await createBikeProduct();

    const response = await listProducts("&search=Buscable");

    expect(response.body.data.products).toHaveLength(1);
    expect(response.body.data.products[0].brand).toBe("Marca Buscable Única");
  });

  it("search still matches by SKU", async () => {
    await createBikeProduct({ variants: [{ sku: "BK-FINDME-M" }] });
    await createBikeProduct({ variants: [{ sku: "BK-OTHER-M" }] });

    const response = await listProducts("&search=FINDME");

    expect(response.body.data.products).toHaveLength(1);
  });

  it("brand=<slug> narrows the list; an unknown slug matches nothing", async () => {
    const brand = await createBrandDoc({ name: "Trek Único", slug: "trek-unico" });
    await createBikeProduct({ brandId: brand._id });
    await createBikeProduct();

    const matched = await listProducts("&brand=trek-unico");
    expect(matched.body.data.products).toHaveLength(1);

    const unmatched = await listProducts("&brand=marca-que-no-existe");
    expect(unmatched.body.data.products).toHaveLength(0);
  });

  it("category=<root id> includes products from child categories", async () => {
    const root = await createBikeCategoryDoc({ name: "Ruta" });
    const child = await BikeCategory.create({ name: "Ruta Aero", slug: "ruta-aero-unico", parent: root._id });
    const otherRoot = await createBikeCategoryDoc({ name: "Montaña" });

    await createBikeProduct({ categoryId: root._id });
    await createBikeProduct({ categoryId: child._id });
    await createBikeProduct({ categoryId: otherRoot._id });

    const response = await listProducts(`&category=${root._id}`);

    expect(response.body.data.products).toHaveLength(2);
  });

  it("stock=out returns only out-of-stock products; stock=low excludes them", async () => {
    const outOfStock = await createBikeProduct({ variants: [{ sku: "BK-OUT-M" }] });
    await InventoryItem.create({ itemType: "bike", itemId: outOfStock._id, sku: "BK-OUT-M", onHand: 0 });

    const low = await createBikeProduct({ variants: [{ sku: "BK-LOW-M" }] });
    await InventoryItem.create({ itemType: "bike", itemId: low._id, sku: "BK-LOW-M", onHand: 3 }); // < default threshold (5)

    const healthy = await createBikeProduct({ variants: [{ sku: "BK-OK-M" }] });
    await InventoryItem.create({ itemType: "bike", itemId: healthy._id, sku: "BK-OK-M", onHand: 100 });

    const outResponse = await listProducts("&stock=out");
    expect(outResponse.body.data.products.map((p: { itemId: string }) => p.itemId)).toEqual([String(outOfStock._id)]);

    const lowResponse = await listProducts("&stock=low");
    expect(lowResponse.body.data.products.map((p: { itemId: string }) => p.itemId)).toEqual([String(low._id)]);
  });

  it("counts partition every product by worst status, unaffected by the active stock filter", async () => {
    const outOfStock = await createBikeProduct({ variants: [{ sku: "BK-CNT-OUT-M" }] });
    await InventoryItem.create({ itemType: "bike", itemId: outOfStock._id, sku: "BK-CNT-OUT-M", onHand: 0 });

    const low = await createBikeProduct({ variants: [{ sku: "BK-CNT-LOW-M" }] });
    await InventoryItem.create({ itemType: "bike", itemId: low._id, sku: "BK-CNT-LOW-M", onHand: 2 });

    await createBikeProduct({ variants: [{ sku: "BK-CNT-ONREQ-M", fulfillmentMode: "on_request" }] });

    const response = await listProducts("&stock=low");

    expect(response.body.data.products).toHaveLength(1);
    const { counts } = response.body.data;
    expect(counts).toMatchObject({ out: 1, low: 1, onRequest: 1 });
    expect(counts.all).toBe(counts.out + counts.low + counts.ok + counts.onRequest);
  });

  it("a product with no inventory rows at all is listed as untracked, never as out of stock", async () => {
    const bike = await createBikeProduct({ variants: [{ sku: "BK-UNTRACKED-M" }] });

    const response = await listProducts("");

    const row = response.body.data.products.find((p: { itemId: string }) => p.itemId === String(bike._id));
    expect(row).toMatchObject({ untrackedVariantCount: 1, variantCount: 1, totalAvailable: 0 });
    expect(row.status).not.toBe("out");
  });

  it("a product whose only active variants are on_request reports status on_request and zero availability", async () => {
    const bike = await createBikeProduct({
      variants: [{ sku: "BK-PREORDER-M", fulfillmentMode: "preorder" }],
    });

    const response = await listProducts("");

    const row = response.body.data.products.find((p: { itemId: string }) => p.itemId === String(bike._id));
    expect(row).toMatchObject({ status: "on_request", totalAvailable: 0 });
  });

  it("paginates exactly at the boundary — no product split across pages", async () => {
    const category = await createBikeCategoryDoc({ name: "Paginación" });
    const bikes = await Promise.all(
      Array.from({ length: 3 }, (_, index) => createBikeProduct({ name: `Página ${index}`, categoryId: category._id })),
    );

    const page1 = await listProducts(`&category=${category._id}&limit=2&page=1&sort=name`);
    const page2 = await listProducts(`&category=${category._id}&limit=2&page=2&sort=name`);

    expect(page1.body.meta).toEqual({ total: 3, page: 1, pages: 2, limit: 2 });
    expect(page1.body.data.products).toHaveLength(2);
    expect(page2.body.data.products).toHaveLength(1);

    const seenIds = [...page1.body.data.products, ...page2.body.data.products].map(
      (product: { itemId: string }) => product.itemId,
    );
    expect(new Set(seenIds).size).toBe(3);
    expect(seenIds.sort()).toEqual(bikes.map((bike) => String(bike._id)).sort());
  });

  it("rejects a request with no itemType", async () => {
    const response = await request(app).get(`${ADMIN}/inventory/products`).set("Cookie", adminCookie);
    expect(response.status).toBe(400);
  });

  it("rejects an unsupported sort field", async () => {
    const response = await listProducts("&sort=reserved");
    expect(response.status).toBe(400);
  });

  it("strips an unrecognized query key instead of letting it reach the filter", async () => {
    await createBikeProduct();
    const response = await request(app)
      .get(`${ADMIN}/inventory/products?itemType=bike&name[$ne]=x`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.products.length).toBeGreaterThan(0);
  });

  it("is registered ahead of the wildcard SKU route — 'products' is never read as an :id", async () => {
    const response = await listProducts("");
    expect(response.status).toBe(200);
  });
});

describe("inventory products list — authorization", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  it("rejects an anonymous request with 401", async () => {
    const response = await request(app).get(`${ADMIN}/inventory/products?itemType=bike`);
    expect(response.status).toBe(401);
  });

  it("rejects an authenticated customer with 403", async () => {
    const customerCookie = await createCustomerSession(app);
    const response = await request(app)
      .get(`${ADMIN}/inventory/products?itemType=bike`)
      .set("Cookie", customerCookie);
    expect(response.status).toBe(403);
  });
});

describe("inventory product detail", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  it("returns every active variant, including ones with no inventory row yet", async () => {
    const bike = await createBikeProduct({
      variants: [
        { sku: "BK-DETAIL-M-RED", size: "M", color: "Rojo" },
        { sku: "BK-DETAIL-L-RED", size: "L", color: "Rojo" },
        { sku: "BK-DETAIL-INACTIVE", isActive: false },
      ],
    });
    await InventoryItem.create({ itemType: "bike", itemId: bike._id, sku: "BK-DETAIL-M-RED", onHand: 4, reserved: 1 });

    const response = await request(app)
      .get(`${ADMIN}/inventory/products/${bike._id}?itemType=bike`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    const { product } = response.body.data;
    expect(product.name).toBe(bike.name);
    expect(product.variants).toHaveLength(2); // the inactive variant is excluded

    const tracked = product.variants.find((v: { sku: string }) => v.sku === "BK-DETAIL-M-RED");
    expect(tracked).toMatchObject({ onHand: 4, reserved: 1, available: 3, color: "Rojo" });
    expect(tracked.inventoryItemId).not.toBeNull();

    const untracked = product.variants.find((v: { sku: string }) => v.sku === "BK-DETAIL-L-RED");
    expect(untracked).toMatchObject({ onHand: 0, reserved: 0, available: 0, inventoryItemId: null });
  });

  it("404s for an id that does not exist", async () => {
    const response = await request(app)
      .get(`${ADMIN}/inventory/products/${new Types.ObjectId()}?itemType=bike`)
      .set("Cookie", adminCookie);
    expect(response.status).toBe(404);
  });

  it("404s when itemType points at the other catalog", async () => {
    const bike = await createBikeProduct();
    const response = await request(app)
      .get(`${ADMIN}/inventory/products/${bike._id}?itemType=accessory`)
      .set("Cookie", adminCookie);
    expect(response.status).toBe(404);
  });
});
