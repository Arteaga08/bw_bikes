import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AccessoryCategory } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

interface ColorSwatchesBody {
  colors: Array<{ value: string; hex: string | null; secondaryHex: string | null }>;
}

/**
 * `/catalog/{bikes,accessories}/colors` — the lightweight sibling of
 * `filter-options` added in M-optimización so a page with no filter sidebar
 * (the PDP, `/comparar`) doesn't pay for the brand/size/price/spec-group
 * facets just to read `.colors`. Same underlying vocabulary as
 * `filter-options` (`catalog-filter-options.test.ts` already covers the
 * count-ordering and archived/inactive scoping in depth against that
 * endpoint) — this file only has to prove the split endpoint resolves the
 * same data, for both catalogs, through its own route.
 */
describe("public catalog color swatches", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let bikeCategoryId: string;
  let accessoryCategoryId: string;
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    bikeCategoryId = String((await createBikeCategoryDoc())._id);
    accessoryCategoryId = String((await AccessoryCategory.create({ name: "Cascos", slug: "cascos" }))._id);
    brandId = String((await createBrandDoc())._id);
  });

  async function createBike(color: string) {
    const suffix = Math.random().toString(16).slice(2, 8);
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send({
        name: `Bici ${color} ${suffix}`,
        brand: brandId,
        category: bikeCategoryId,
        shortDescription: "Bici de prueba",
        description: "Descripción de prueba",
        price: 10_000_00,
        variants: [{ sku: `BK-${Math.random().toString(16).slice(2, 8)}`, size: "M", color, fulfillmentMode: "in_stock" }],
      });
    expect(response.status).toBe(201);
    return response.body.data.bike as { id: string };
  }

  async function createAccessory(color: string) {
    const suffix = Math.random().toString(16).slice(2, 8);
    const response = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send({
        name: `Casco ${color} ${suffix}`,
        brand: brandId,
        category: accessoryCategoryId,
        description: "Descripción de prueba",
        price: 1_000_00,
        variants: [{ sku: `AC-${Math.random().toString(16).slice(2, 8)}`, color, fulfillmentMode: "in_stock" }],
      });
    expect(response.status).toBe(201);
    return response.body.data.accessory as { id: string };
  }

  it("returns bike colors ordered by how many bikes carry each value, with hex resolved from ColorTemplate", async () => {
    await request(app).post(`${ADMIN}/color-templates`).set("Cookie", adminCookie).send({ value: "Negro", hex: "#111111" });
    await createBike("Negro");
    await createBike("Negro");
    await createBike("Rojo");

    const response = await request(app).get(`${PUBLIC}/bikes/colors`);

    expect(response.status).toBe(200);
    const body = response.body.data as ColorSwatchesBody;
    expect(body.colors.map((c) => c.value)).toEqual(["Negro", "Rojo"]);
    expect(body.colors.find((c) => c.value === "Negro")?.hex).toBe("#111111");
    // Auto-learned from the variant save, never manually given a hex.
    expect(body.colors.find((c) => c.value === "Rojo")?.hex).toBeNull();
  });

  it("resolves the accessory catalog's own colors through its own route, independent of the bike catalog", async () => {
    await createBike("Negro");
    await createAccessory("Azul");

    const response = await request(app).get(`${PUBLIC}/accessories/colors`);

    expect(response.status).toBe(200);
    const body = response.body.data as ColorSwatchesBody;
    expect(body.colors.map((c) => c.value)).toEqual(["Azul"]);
  });

  it("excludes an archived bike's colors, same visibility scope as the rest of the public catalog", async () => {
    const bike = await createBike("Verde");
    await request(app).post(`${ADMIN}/bikes/${bike.id}/archive`).set("Cookie", adminCookie);

    const response = await request(app).get(`${PUBLIC}/bikes/colors`);

    expect(response.status).toBe(200);
    const body = response.body.data as ColorSwatchesBody;
    expect(body.colors.map((c) => c.value)).not.toContain("Verde");
  });

  it("returns an empty list rather than an error when the catalog has no colors yet", async () => {
    const response = await request(app).get(`${PUBLIC}/bikes/colors`);

    expect(response.status).toBe(200);
    expect((response.body.data as ColorSwatchesBody).colors).toEqual([]);
  });
});
