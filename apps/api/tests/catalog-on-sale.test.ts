import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AccessoryCategory } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

interface OnSaleBody {
  bikes: Array<{ id: string; name: string; price: number; compareAtPrice?: number }>;
  accessories: Array<{ id: string; name: string; price: number; compareAtPrice?: number }>;
  order: Array<{ kind: "bike" | "accessory"; id: string }>;
}

describe("public on-sale catalog (/catalog/on-sale)", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let bikeCategoryId: string;
  let accessoryCategoryId: string;
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    bikeCategoryId = String((await createBikeCategoryDoc())._id);
    const suffix = Math.random().toString(16).slice(2, 8);
    accessoryCategoryId = String(
      (await AccessoryCategory.create({ name: "Cascos", slug: `cascos-${suffix}`, isActive: true }))._id,
    );
    brandId = String((await createBrandDoc())._id);
  });

  function bikePayload(overrides: Record<string, unknown> = {}) {
    const suffix = Math.random().toString(16).slice(2, 8);
    return {
      name: `Bici de prueba ${suffix}`,
      brand: brandId,
      category: bikeCategoryId,
      shortDescription: "Bici de prueba",
      description: "Descripción de prueba",
      price: 10_000_00,
      ...overrides,
    };
  }

  function accessoryPayload(overrides: Record<string, unknown> = {}) {
    const suffix = Math.random().toString(16).slice(2, 8);
    return {
      name: `Accesorio de prueba ${suffix}`,
      brand: brandId,
      category: accessoryCategoryId,
      description: "Descripción de prueba",
      price: 1_000_00,
      ...overrides,
    };
  }

  async function createBike(overrides: Record<string, unknown> = {}) {
    const response = await request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send(bikePayload(overrides));
    expect(response.status).toBe(201);
    return response.body.data.bike as { id: string };
  }

  async function createAccessory(overrides: Record<string, unknown> = {}) {
    const response = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(overrides));
    expect(response.status).toBe(201);
    return response.body.data.accessory as { id: string };
  }

  it("only returns products with compareAtPrice above price, mixing bikes and accessories", async () => {
    const saleBike = await createBike({ price: 10_000_00, compareAtPrice: 15_000_00 });
    await createBike({ price: 10_000_00 }); // no discount
    const saleAccessory = await createAccessory({ price: 1_000_00, compareAtPrice: 1_500_00 });
    await createAccessory({ price: 1_000_00 }); // no discount

    const response = await request(app).get(`${PUBLIC}/on-sale`);
    expect(response.status).toBe(200);

    const body = response.body.data as OnSaleBody;
    expect(body.bikes.map((b) => b.id)).toEqual([saleBike.id]);
    expect(body.accessories.map((a) => a.id)).toEqual([saleAccessory.id]);
    expect(body.order).toHaveLength(2);
    expect(new Set(body.order.map((row) => row.kind))).toEqual(new Set(["bike", "accessory"]));
  });

  it("respects the brand filter across both catalogs", async () => {
    const otherBrandId = String((await createBrandDoc({ name: "Canyon", slug: "canyon" }))._id);
    await createBike({ price: 10_000_00, compareAtPrice: 15_000_00, brand: otherBrandId });
    const matchingAccessory = await createAccessory({ price: 1_000_00, compareAtPrice: 1_500_00, brand: brandId });

    const brand = await request(app).get(`${PUBLIC}/brands`);
    const brandSlug = (brand.body.data.brands as Array<{ id: string; slug: string }>).find((b) => b.id === brandId)!
      .slug;

    const response = await request(app).get(`${PUBLIC}/on-sale?brand=${brandSlug}`);
    const body = response.body.data as OnSaleBody;
    expect(body.bikes).toHaveLength(0);
    expect(body.accessories.map((a) => a.id)).toEqual([matchingAccessory.id]);
  });

  it("respects minPrice/maxPrice across both catalogs", async () => {
    await createBike({ price: 5_000_00, compareAtPrice: 6_000_00 });
    const inRange = await createAccessory({ price: 20_000_00, compareAtPrice: 25_000_00 });

    const response = await request(app).get(`${PUBLIC}/on-sale?minPrice=${10_000_00}`);
    const body = response.body.data as OnSaleBody;
    expect(body.bikes).toHaveLength(0);
    expect(body.accessories.map((a) => a.id)).toEqual([inRange.id]);
  });

  it("paginates the merged, sorted result and reports the combined total", async () => {
    // Three on-sale products total (two bikes, one accessory), ascending by price.
    const cheap = await createBike({ price: 1_000_00, compareAtPrice: 2_000_00 });
    const mid = await createAccessory({ price: 2_000_00, compareAtPrice: 3_000_00 });
    const expensive = await createBike({ price: 3_000_00, compareAtPrice: 4_000_00 });

    const firstPage = await request(app).get(`${PUBLIC}/on-sale?sort=price&limit=2&page=1`);
    expect(firstPage.body.meta).toMatchObject({ total: 3, page: 1, pages: 2, limit: 2 });
    expect(firstPage.body.data.order.map((row: { id: string }) => row.id)).toEqual([cheap.id, mid.id]);

    const secondPage = await request(app).get(`${PUBLIC}/on-sale?sort=price&limit=2&page=2`);
    expect(secondPage.body.meta).toMatchObject({ total: 3, page: 2, pages: 2, limit: 2 });
    expect(secondPage.body.data.order.map((row: { id: string }) => row.id)).toEqual([expensive.id]);
  });

  it("sorts descending by price across both catalogs", async () => {
    const cheap = await createAccessory({ price: 1_000_00, compareAtPrice: 2_000_00 });
    const expensive = await createBike({ price: 3_000_00, compareAtPrice: 4_000_00 });

    const response = await request(app).get(`${PUBLIC}/on-sale?sort=-price`);
    const order = response.body.data.order as Array<{ id: string }>;
    expect(order.map((row) => row.id)).toEqual([expensive.id, cheap.id]);
  });
});
