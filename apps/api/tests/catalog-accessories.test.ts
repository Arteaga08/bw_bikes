import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Accessory, AccessoryCategory, BikeCategory } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

function accessoryPayload(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Casco Evade 3",
    brand: "Specialized",
    category: categoryId,
    description: "Casco aerodinámico de ruta con ventilación optimizada.",
    price: 899_900,
    variants: [
      { sku: "AC-EVADE-S", size: "S", color: "Blanco", fulfillmentMode: "in_stock" },
      { sku: "AC-EVADE-M", size: "M", color: "Blanco", fulfillmentMode: "preorder" },
    ],
    ...overrides,
  };
}

describe("accessory CRUD", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let categoryId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const category = await AccessoryCategory.create({ name: "Cascos", slug: "cascos" });
    categoryId = String(category._id);
  });

  it("creates, reads, updates and archives an accessory through the API", async () => {
    const created = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(categoryId));

    expect(created.status).toBe(201);
    expect(created.body.data.accessory.slug).toBe("casco-evade-3");
    const id = created.body.data.accessory._id as string;

    const read = await request(app).get(`${ADMIN}/accessories/${id}`).set("Cookie", adminCookie);
    expect(read.status).toBe(200);
    expect(read.body.data.accessory.variants).toHaveLength(2);

    const updated = await request(app)
      .patch(`${ADMIN}/accessories/${id}`)
      .set("Cookie", adminCookie)
      .send({ price: 799_900 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.accessory.price).toBe(799_900);

    const archived = await request(app).post(`${ADMIN}/accessories/${id}/archive`).set("Cookie", adminCookie);
    expect(archived.status).toBe(200);
    expect(await Accessory.countDocuments()).toBe(1);
  });

  it("has no brakeType: a bike-only field is stripped from the payload", async () => {
    const response = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(categoryId, { brakeType: "rim", shortDescription: "no aplica" }));

    expect(response.status).toBe(201);
    const stored = await Accessory.findById(response.body.data.accessory._id).lean().exec();
    expect(stored).not.toHaveProperty("brakeType");
    expect(stored).not.toHaveProperty("shortDescription");
  });

  it("rejects a category taken from the bike tree", async () => {
    const bikeCategory = await BikeCategory.create({ name: "Ruta", slug: "ruta" });

    const response = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(String(bikeCategory._id)));

    expect(response.status).toBe(404);
  });

  it("edits the free-form spec sheet", async () => {
    const created = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(categoryId));
    const id = created.body.data.accessory._id as string;

    const response = await request(app)
      .put(`${ADMIN}/accessories/${id}/spec-groups`)
      .set("Cookie", adminCookie)
      .send({
        groups: [
          {
            title: "Certificaciones",
            order: 0,
            fields: [{ label: "Norma", value: "CPSC / EN 1078", order: 0 }],
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.specGroups[0].fields[0].value).toBe("CPSC / EN 1078");
  });

  it("serves the public detail with its own DTO", async () => {
    await request(app).post(`${ADMIN}/accessories`).set("Cookie", adminCookie).send(accessoryPayload(categoryId));

    const response = await request(app).get(`${PUBLIC}/accessories/casco-evade-3`);

    expect(response.status).toBe(200);
    expect(response.body.data.accessory.currency).toBe("MXN");
    expect(response.body.data.accessory.category.slug).toBe("cascos");
    expect(response.body.data.accessory).not.toHaveProperty("isActive");
  });
});
