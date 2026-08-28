import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

interface FilterOptionsBody {
  brands: Array<{ slug: string }>;
  sizes: string[];
  colors: Array<{ value: string; hex: string | null; secondaryHex: string | null }>;
  price: { min: number; max: number } | null;
  specs: Array<{ label: string; values: string[] }>;
}

describe("public catalog filter options", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let categoryId: string;
  let specializedId: string;
  let canyonId: string;

  function bikePayload(overrides: Record<string, unknown> = {}) {
    const suffix = Math.random().toString(16).slice(2, 8);
    return {
      name: `Bici de prueba ${suffix}`,
      brand: specializedId,
      category: categoryId,
      shortDescription: "Bici de prueba",
      description: "Descripción de prueba",
      price: 10_000_00,
      variants: [{ sku: `BK-${Math.random().toString(16).slice(2, 8)}`, size: "M", color: "Negro", fulfillmentMode: "in_stock" }],
      ...overrides,
    };
  }

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    categoryId = String((await createBikeCategoryDoc())._id);
    specializedId = String((await createBrandDoc({ name: "Specialized", slug: "specialized" }))._id);
    canyonId = String((await createBrandDoc({ name: "Canyon", slug: "canyon" }))._id);
  });

  async function createBike(overrides: Record<string, unknown> = {}) {
    const response = await request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send(bikePayload(overrides));
    expect(response.status).toBe(201);
    return response.body.data.bike as { id: string };
  }

  it("returns brands, sizes and colors ordered by how many products carry each value", async () => {
    // Specialized: two bikes, size M twice, color Negro twice.
    await createBike({ brand: specializedId, variants: [{ sku: "BK-A1", size: "M", color: "Negro", fulfillmentMode: "in_stock" }] });
    await createBike({ brand: specializedId, variants: [{ sku: "BK-A2", size: "M", color: "Negro", fulfillmentMode: "in_stock" }] });
    // Canyon: one bike, size L, color Rojo.
    await createBike({ brand: canyonId, variants: [{ sku: "BK-B1", size: "L", color: "Rojo", fulfillmentMode: "in_stock" }] });

    const response = await request(app).get(`${PUBLIC}/bikes/filter-options`);
    expect(response.status).toBe(200);

    const body = response.body.data as FilterOptionsBody;
    expect(body.brands.map((b) => b.slug)).toEqual(["specialized", "canyon"]);
    expect(body.sizes).toEqual(["M", "L"]);
    expect(body.colors.map((c) => c.value)).toEqual(["Negro", "Rojo"]);
  });

  it("resolves a color's hex from ColorTemplate, and falls back to null when there's no template", async () => {
    await request(app)
      .post(`${ADMIN}/color-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "Negro Mate", hex: "#111111" });

    await createBike({ variants: [{ sku: "BK-C1", size: "M", color: "Negro Mate", fulfillmentMode: "in_stock" }] });
    await createBike({ variants: [{ sku: "BK-C2", size: "M", color: "Azul Cielo", fulfillmentMode: "in_stock" }] });

    const response = await request(app).get(`${PUBLIC}/bikes/filter-options`);
    const body = response.body.data as FilterOptionsBody;

    expect(body.colors.find((c) => c.value === "Negro Mate")?.hex).toBe("#111111");
    // Auto-learned from the variant save, never manually given a hex.
    expect(body.colors.find((c) => c.value === "Azul Cielo")?.hex).toBeNull();
  });

  it("returns the real min/max price across the catalog", async () => {
    await createBike({ price: 10_000_00 });
    await createBike({ price: 25_000_00 });
    await createBike({ price: 17_000_00 });

    const response = await request(app).get(`${PUBLIC}/bikes/filter-options`);
    const body = response.body.data as FilterOptionsBody;

    expect(body.price).toEqual({ min: 10_000_00, max: 25_000_00 });
  });

  it("only offers spec labels an admin turned on with isFilterable, ordered by the values' coverage", async () => {
    await request(app)
      .post(`${ADMIN}/spec-templates`)
      .set("Cookie", adminCookie)
      .send({
        title: "Cuadro",
        fields: [
          { label: "Material", order: 0, isFilterable: true },
          { label: "Peso", order: 1, isFilterable: false },
        ],
      });

    await createBike({
      specGroups: [
        { title: "Cuadro", order: 0, fields: [{ label: "Material", value: "Carbono", order: 0 }, { label: "Peso", value: "9.2 kg", order: 1 }] },
      ],
    });
    await createBike({
      specGroups: [
        { title: "Cuadro", order: 0, fields: [{ label: "Material", value: "Carbono", order: 0 }] },
      ],
    });
    await createBike({
      specGroups: [
        { title: "Cuadro", order: 0, fields: [{ label: "Material", value: "Aluminio", order: 0 }] },
      ],
    });

    const response = await request(app).get(`${PUBLIC}/bikes/filter-options`);
    const body = response.body.data as FilterOptionsBody;

    // "Peso" never turned into a group at all — the flag was off.
    expect(body.specs.map((group) => group.label)).toEqual(["Material"]);
    expect(body.specs[0]?.values).toEqual(["Carbono", "Aluminio"]);
  });

  it("excludes archived products from every list", async () => {
    const bike = await createBike({ price: 90_000_00, variants: [{ sku: "BK-D1", size: "XL", color: "Verde", fulfillmentMode: "in_stock" }] });
    await request(app).post(`${ADMIN}/bikes/${bike.id}/archive`).set("Cookie", adminCookie);
    await createBike({ price: 10_000_00 });

    const response = await request(app).get(`${PUBLIC}/bikes/filter-options`);
    const body = response.body.data as FilterOptionsBody;

    expect(body.sizes).not.toContain("XL");
    expect(body.colors.map((c) => c.value)).not.toContain("Verde");
    expect(body.price?.max).toBe(10_000_00);
  });
});

describe("multi-select on the public product list", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let categoryId: string;
  let specializedId: string;
  let canyonId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    categoryId = String((await createBikeCategoryDoc())._id);
    specializedId = String((await createBrandDoc({ name: "Specialized", slug: "specialized" }))._id);
    canyonId = String((await createBrandDoc({ name: "Canyon", slug: "canyon" }))._id);
  });

  async function createBike(name: string, brand: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send({
        name,
        brand,
        category: categoryId,
        shortDescription: "Bici de prueba",
        description: "Descripción de prueba",
        price: 10_000_00,
        variants: [{ sku: `BK-${Math.random().toString(16).slice(2, 8)}`, size: "M", color: "Negro", fulfillmentMode: "in_stock" }],
        ...overrides,
      });
    expect(response.status).toBe(201);
    return response.body.data.bike as { id: string; slug: string };
  }

  it("brand=a,b returns the union of both brands, same as the mega-menu's single-brand link still works", async () => {
    await createBike("Tarmac", specializedId);
    await createBike("Ultimate", canyonId);
    await createBike("Sin marca listada", await createBrandDoc({ name: "Trek", slug: "trek" }).then((b) => String(b._id)));

    const union = await request(app).get(`${PUBLIC}/bikes?brand=specialized,canyon`);
    expect(union.status).toBe(200);
    expect(union.body.data.bikes.map((b: { slug: string }) => b.slug).sort()).toEqual(["tarmac", "ultimate"]);

    const single = await request(app).get(`${PUBLIC}/bikes?brand=specialized`);
    expect(single.body.data.bikes).toHaveLength(1);
    expect(single.body.data.bikes[0].slug).toBe("tarmac");
  });

  it("size=M,L returns bikes matching either size", async () => {
    await createBike("Talla M", specializedId, { variants: [{ sku: "BK-SM", size: "M", fulfillmentMode: "in_stock" }] });
    await createBike("Talla L", specializedId, { variants: [{ sku: "BK-SL", size: "L", fulfillmentMode: "in_stock" }] });
    await createBike("Talla XL", specializedId, { variants: [{ sku: "BK-SXL", size: "XL", fulfillmentMode: "in_stock" }] });

    const response = await request(app).get(`${PUBLIC}/bikes?size=M,L`);
    expect(response.body.data.bikes.map((b: { slug: string }) => b.slug).sort()).toEqual(["talla-l", "talla-m"]);
  });

  it("spec filters AND across labels and OR within one label's values", async () => {
    await request(app)
      .post(`${ADMIN}/spec-templates`)
      .set("Cookie", adminCookie)
      .send({ title: "Cuadro", fields: [{ label: "Material", order: 0, isFilterable: true }] });

    await createBike("Carbono ligera", specializedId, {
      specGroups: [{ title: "Cuadro", order: 0, fields: [{ label: "Material", value: "Carbono", order: 0 }, { label: "Peso", value: "8 kg", order: 1 }] }],
    });
    await createBike("Aluminio", specializedId, {
      specGroups: [{ title: "Cuadro", order: 0, fields: [{ label: "Material", value: "Aluminio", order: 0 }, { label: "Peso", value: "9.5 kg", order: 1 }] }],
    });
    await createBike("Carbono pesada", specializedId, {
      specGroups: [{ title: "Cuadro", order: 0, fields: [{ label: "Material", value: "Carbono", order: 0 }, { label: "Peso", value: "9.5 kg", order: 1 }] }],
    });

    const orWithinLabel = await request(app).get(`${PUBLIC}/bikes`).query({ spec: "Material:Carbono|Aluminio" });
    expect(orWithinLabel.body.data.bikes).toHaveLength(3);

    const onlyCarbono = await request(app).get(`${PUBLIC}/bikes`).query({ spec: "Material:Carbono" });
    expect(onlyCarbono.body.data.bikes.map((b: { slug: string }) => b.slug).sort()).toEqual(["carbono-ligera", "carbono-pesada"]);

    const andAcrossLabels = await request(app)
      .get(`${PUBLIC}/bikes`)
      .query({ spec: ["Material:Carbono", "Peso:9.5 kg"] });
    expect(andAcrossLabels.body.data.bikes).toHaveLength(1);
    expect(andAcrossLabels.body.data.bikes[0].slug).toBe("carbono-pesada");
  });
});
