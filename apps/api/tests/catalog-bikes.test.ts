import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Accessory, AccessoryCategory, Bike } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

function bikePayload(categoryId: string, brandId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Tarmac SL8 Pro",
    brand: brandId,
    category: categoryId,
    shortDescription: "Bici de ruta de alto rendimiento.",
    description: "Cuadro de carbono FACT 10r, geometría Rider-First.",
    price: 19_999_900,
    variants: [
      { sku: "BK-TARMAC-M", size: "M", color: "Negro", fulfillmentMode: "in_stock" },
      { sku: "BK-TARMAC-L", size: "L", color: "Negro", price: 20_499_900, fulfillmentMode: "on_request" },
    ],
    ...overrides,
  };
}

describe("bike CRUD", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let categoryId: string;
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const category = await createBikeCategoryDoc({ name: "Ruta", slug: "ruta" });
    categoryId = String(category._id);
    brandId = String((await createBrandDoc())._id);
  });

  it("creates, reads, updates and archives a bike through the API", async () => {
    const created = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, brandId));

    expect(created.status).toBe(201);
    expect(created.body.data.bike.slug).toBe("tarmac-sl8-pro");
    expect(created.body.data.bike.variants).toHaveLength(2);
    const id = created.body.data.bike.id as string;

    const read = await request(app).get(`${ADMIN}/bikes/${id}`).set("Cookie", adminCookie);
    expect(read.status).toBe(200);
    expect(read.body.data.bike.shortDescription).toBe("Bici de ruta de alto rendimiento.");

    const otherBrand = await createBrandDoc();
    const updated = await request(app)
      .patch(`${ADMIN}/bikes/${id}`)
      .set("Cookie", adminCookie)
      .send({ price: 18_500_000, brand: String(otherBrand._id) });
    expect(updated.status).toBe(200);
    expect(updated.body.data.bike.price).toBe(18_500_000);
    expect(updated.body.data.bike.brand.id).toBe(String(otherBrand._id));

    const archived = await request(app).post(`${ADMIN}/bikes/${id}/archive`).set("Cookie", adminCookie);
    expect(archived.status).toBe(200);
    expect(archived.body.data.bike.isActive).toBe(false);
    expect(archived.body.data.bike.archivedAt).not.toBeNull();

    // Archiving is a logical delete — the document survives for M4/M5.
    expect(await Bike.countDocuments()).toBe(1);

    const restored = await request(app).post(`${ADMIN}/bikes/${id}/restore`).set("Cookie", adminCookie);
    expect(restored.status).toBe(200);
    expect(restored.body.data.bike.isActive).toBe(true);
  });

  it("stores prices as integer cents and rejects a decimal amount", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, brandId, { price: 19_999.9 }));

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("centavos");
  });

  it("rejects a duplicate slug with 409", async () => {
    await request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send(bikePayload(categoryId, brandId));

    const duplicate = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, brandId));

    expect(duplicate.status).toBe(409);
  });

  it("rejects a nonexistent brand with 404", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, "507f1f77bcf86cd799439011"));

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("marca");
  });

  it("rejects two variants sharing a SKU inside the same bike", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(
        bikePayload(categoryId, brandId, {
          variants: [
            { sku: "BK-DUP", size: "M", fulfillmentMode: "in_stock" },
            { sku: "BK-DUP", size: "L", fulfillmentMode: "in_stock" },
          ],
        }),
      );

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("repetido");
  });

  it("rejects a category from the other catalog's tree", async () => {
    const accessoryCategory = await AccessoryCategory.create({ name: "Cascos", slug: "cascos" });

    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(String(accessoryCategory._id), brandId));

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("categoría");
  });

  it("ignores isActive and archivedAt injected in the create payload", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, brandId, { isActive: false, archivedAt: new Date().toISOString() }));

    expect(response.status).toBe(201);
    // Verified against the DB, not the response: stripUnknown discarded both
    // fields, so the schema defaults won.
    const stored = await Bike.findById(response.body.data.bike.id).exec();
    expect(stored?.isActive).toBe(true);
    expect(stored?.archivedAt).toBeNull();
  });
});

describe("cross-sell (relatedAccessories)", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let categoryId: string;
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    categoryId = String((await createBikeCategoryDoc({ slug: "ruta" }))._id);
    brandId = String((await createBrandDoc())._id);
  });

  it("rejects a suggested accessory that doesn't exist", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, brandId, { relatedAccessories: ["507f1f77bcf86cd799439011"] }));

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("accesorios sugeridos");
  });

  it("resolves suggested accessories on the public PDP", async () => {
    const accessoryCategory = await AccessoryCategory.create({ name: "Cascos", slug: "cascos" });
    const helmetBrand = await createBrandDoc();
    const helmet = await Accessory.create({
      name: "Casco Evade 3",
      slug: "casco-evade-3",
      brand: helmetBrand._id,
      category: accessoryCategory._id,
      description: "Casco aerodinámico",
      price: 899_900,
    });

    const created = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, brandId, { relatedAccessories: [String(helmet._id)] }));
    expect(created.status).toBe(201);

    const pdp = await request(app).get(`${PUBLIC}/bikes/tarmac-sl8-pro`);

    expect(pdp.status).toBe(200);
    expect(pdp.body.data.bike.relatedAccessories).toHaveLength(1);
    expect(pdp.body.data.bike.relatedAccessories[0].slug).toBe("casco-evade-3");
  });
});

describe("public bike reads", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let categoryId: string;
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    categoryId = String((await createBikeCategoryDoc({ slug: "ruta" }))._id);
    brandId = String((await createBrandDoc())._id);
  });

  it("returns 404 for an archived bike and omits internal fields", async () => {
    const created = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, brandId));
    const id = created.body.data.bike.id as string;

    const visible = await request(app).get(`${PUBLIC}/bikes/tarmac-sl8-pro`);
    expect(visible.status).toBe(200);
    // The public DTO is built field by field — internal state never ships.
    expect(visible.body.data.bike).not.toHaveProperty("isActive");
    expect(visible.body.data.bike).not.toHaveProperty("archivedAt");
    expect(visible.body.data.bike).not.toHaveProperty("updatedAt");
    expect(visible.body.data.bike.currency).toBe("MXN");

    await request(app).post(`${ADMIN}/bikes/${id}/archive`).set("Cookie", adminCookie);

    const archived = await request(app).get(`${PUBLIC}/bikes/tarmac-sl8-pro`);
    expect(archived.status).toBe(404);
  });

  it("hides inactive variants from the public payload", async () => {
    await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(
        bikePayload(categoryId, brandId, {
          variants: [
            { sku: "BK-ON", size: "M", fulfillmentMode: "in_stock", isActive: true },
            { sku: "BK-OFF", size: "L", fulfillmentMode: "in_stock", isActive: false },
          ],
        }),
      );

    const pdp = await request(app).get(`${PUBLIC}/bikes/tarmac-sl8-pro`);

    expect(pdp.body.data.bike.variants).toHaveLength(1);
    expect(pdp.body.data.bike.variants[0].sku).toBe("BK-ON");
  });
});

describe("admin DTO shape (M10)", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let categoryId: string;
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    categoryId = String((await createBikeCategoryDoc({ slug: "ruta" }))._id);
    brandId = String((await createBrandDoc())._id);
  });

  it("exposes id/isActive/archivedAt/timestamps and keeps every variant, unlike the public DTO", async () => {
    const accessoryCategory = await AccessoryCategory.create({ name: "Cascos", slug: "cascos-dto" });
    const helmetBrand = await createBrandDoc();
    const helmet = await Accessory.create({
      name: "Casco Evade 3",
      slug: "casco-evade-3-dto",
      brand: helmetBrand._id,
      category: accessoryCategory._id,
      description: "Casco aerodinámico",
      price: 899_900,
    });

    const created = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(
        bikePayload(categoryId, brandId, {
          relatedAccessories: [String(helmet._id)],
          variants: [
            { sku: "BK-ON", size: "M", fulfillmentMode: "in_stock", isActive: true },
            { sku: "BK-OFF", size: "L", fulfillmentMode: "in_stock", isActive: false },
          ],
        }),
      );
    expect(created.status).toBe(201);
    const id = created.body.data.bike.id as string;

    const read = await request(app).get(`${ADMIN}/bikes/${id}`).set("Cookie", adminCookie);

    expect(read.status).toBe(200);
    const bike = read.body.data.bike;
    expect(bike.id).toBe(id);
    expect(bike).not.toHaveProperty("_id");
    expect(bike).not.toHaveProperty("__v");
    expect(bike.brand.id).toBe(brandId);
    expect(bike.isActive).toBe(true);
    expect(bike.archivedAt).toBeNull();
    expect(bike.createdAt).toEqual(expect.any(String));
    expect(bike.updatedAt).toEqual(expect.any(String));
    // Unlike the public DTO, the admin sees every variant — it has to be able
    // to re-enable one it turned off.
    expect(bike.variants).toHaveLength(2);
    expect(bike.variants.map((variant: { sku: string }) => variant.sku).sort()).toEqual(["BK-OFF", "BK-ON"]);
    // Resolved for the editor's picker, not left as a bare id.
    expect(bike.relatedAccessories).toHaveLength(1);
    expect(bike.relatedAccessories[0].name).toBe("Casco Evade 3");

    const listResponse = await request(app).get(`${ADMIN}/bikes`).set("Cookie", adminCookie);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.bikes[0].id).toBe(id);
    expect(listResponse.body.data.bikes[0]).not.toHaveProperty("_id");
  });

  it("still shows an accessory suggestion that was archived after being curated", async () => {
    const accessoryCategory = await AccessoryCategory.create({ name: "Cascos", slug: "cascos-archived" });
    const helmetBrand = await createBrandDoc();
    const helmet = await Accessory.create({
      name: "Casco a archivar",
      slug: "casco-a-archivar",
      brand: helmetBrand._id,
      category: accessoryCategory._id,
      description: "Casco",
      price: 500_000,
    });

    const created = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, brandId, { relatedAccessories: [String(helmet._id)] }));
    const id = created.body.data.bike.id as string;

    await request(app).post(`${ADMIN}/accessories/${String(helmet._id)}/archive`).set("Cookie", adminCookie);

    const read = await request(app).get(`${ADMIN}/bikes/${id}`).set("Cookie", adminCookie);

    expect(read.status).toBe(200);
    // The public PDP would drop it (`getPublicBySlug`'s visibility match) —
    // the admin editor must not, so the admin can see it and remove it
    // deliberately instead of it silently vanishing from the payload.
    expect(read.body.data.bike.relatedAccessories).toHaveLength(1);
    expect(read.body.data.bike.relatedAccessories[0].slug).toBe("casco-a-archivar");
  });
});
