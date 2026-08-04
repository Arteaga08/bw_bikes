import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Accessory, AccessoryCategory, Bike } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

function bikePayload(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Tarmac SL8 Pro",
    brand: "Specialized",
    category: categoryId,
    shortDescription: "Bici de ruta de alto rendimiento.",
    description: "Cuadro de carbono FACT 10r, geometría Rider-First.",
    price: 19_999_900,
    brakeType: "hydraulic_disc",
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

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const category = await createBikeCategoryDoc({ name: "Ruta", slug: "ruta" });
    categoryId = String(category._id);
  });

  it("creates, reads, updates and archives a bike through the API", async () => {
    const created = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId));

    expect(created.status).toBe(201);
    expect(created.body.data.bike.slug).toBe("tarmac-sl8-pro");
    expect(created.body.data.bike.variants).toHaveLength(2);
    const id = created.body.data.bike._id as string;

    const read = await request(app).get(`${ADMIN}/bikes/${id}`).set("Cookie", adminCookie);
    expect(read.status).toBe(200);
    expect(read.body.data.bike.brakeType).toBe("hydraulic_disc");

    const updated = await request(app)
      .patch(`${ADMIN}/bikes/${id}`)
      .set("Cookie", adminCookie)
      .send({ price: 18_500_000, brand: "Specialized MX" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.bike.price).toBe(18_500_000);

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
      .send(bikePayload(categoryId, { price: 19_999.9 }));

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("centavos");
  });

  it("rejects a duplicate slug with 409", async () => {
    await request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send(bikePayload(categoryId));

    const duplicate = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId));

    expect(duplicate.status).toBe(409);
  });

  it("rejects two variants sharing a SKU inside the same bike", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(
        bikePayload(categoryId, {
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
      .send(bikePayload(String(accessoryCategory._id)));

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("categoría");
  });

  it("ignores isActive and archivedAt injected in the create payload", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, { isActive: false, archivedAt: new Date().toISOString() }));

    expect(response.status).toBe(201);
    // Verified against the DB, not the response: stripUnknown discarded both
    // fields, so the schema defaults won.
    const stored = await Bike.findById(response.body.data.bike._id).exec();
    expect(stored?.isActive).toBe(true);
    expect(stored?.archivedAt).toBeNull();
  });
});

describe("cross-sell (relatedAccessories)", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let categoryId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    categoryId = String((await createBikeCategoryDoc({ slug: "ruta" }))._id);
  });

  it("rejects a suggested accessory that doesn't exist", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, { relatedAccessories: ["507f1f77bcf86cd799439011"] }));

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("accesorios sugeridos");
  });

  it("resolves suggested accessories on the public PDP", async () => {
    const accessoryCategory = await AccessoryCategory.create({ name: "Cascos", slug: "cascos" });
    const helmet = await Accessory.create({
      name: "Casco Evade 3",
      slug: "casco-evade-3",
      brand: "Specialized",
      category: accessoryCategory._id,
      description: "Casco aerodinámico",
      price: 899_900,
    });

    const created = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId, { relatedAccessories: [String(helmet._id)] }));
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

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    categoryId = String((await createBikeCategoryDoc({ slug: "ruta" }))._id);
  });

  it("returns 404 for an archived bike and omits internal fields", async () => {
    const created = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload(categoryId));
    const id = created.body.data.bike._id as string;

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
        bikePayload(categoryId, {
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
