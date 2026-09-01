import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Accessory, AccessoryCategory, BikeCategory } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

function accessoryPayload(categoryId: string, brandId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Casco Evade 3",
    brand: brandId,
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
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const category = await AccessoryCategory.create({ name: "Cascos", slug: "cascos" });
    categoryId = String(category._id);
    brandId = String((await createBrandDoc())._id);
  });

  it("creates, reads, updates and archives an accessory through the API", async () => {
    const created = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(categoryId, brandId));

    expect(created.status).toBe(201);
    expect(created.body.data.accessory.slug).toBe("casco-evade-3");
    const id = created.body.data.accessory.id as string;

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

  it("has no shortDescription: a bike-only field is stripped from the payload", async () => {
    const response = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(categoryId, brandId, { shortDescription: "no aplica" }));

    expect(response.status).toBe(201);
    const stored = await Accessory.findById(response.body.data.accessory.id).lean().exec();
    expect(stored).not.toHaveProperty("shortDescription");
  });

  it("rejects a category taken from the bike tree", async () => {
    const bikeCategory = await BikeCategory.create({ name: "Ruta", slug: "ruta" });

    const response = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(String(bikeCategory._id), brandId));

    expect(response.status).toBe(404);
  });

  it("rejects a nonexistent brand with 404", async () => {
    const response = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(categoryId, "507f1f77bcf86cd799439011"));

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("marca");
  });

  it("edits the free-form spec sheet", async () => {
    const created = await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(categoryId, brandId));
    const id = created.body.data.accessory.id as string;

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
    await request(app)
      .post(`${ADMIN}/accessories`)
      .set("Cookie", adminCookie)
      .send(accessoryPayload(categoryId, brandId));

    const response = await request(app).get(`${PUBLIC}/accessories/casco-evade-3`);

    expect(response.status).toBe(200);
    expect(response.body.data.accessory.currency).toBe("MXN");
    expect(response.body.data.accessory.category.slug).toBe("cascos");
    expect(response.body.data.accessory).not.toHaveProperty("isActive");
  });

  /**
   * `toPublicAccessory` used to sort `specGroups` and ship it as-is, unlike
   * `toPublicBike`'s `toPublicSpecGroups` — a hidden group, a hidden field or
   * a blank value reached the accessory PDP while the same sheet on a bike
   * was already withheld. Mirrors `catalog-spec-groups.test.ts`'s
   * "visibility (M10.6)" suite (bikes) so the two kinds are pinned to the
   * same contract going forward.
   */
  describe("spec sheet visibility (bug parity with bikes)", () => {
    const MIXED_GROUPS = [
      {
        title: "Certificaciones",
        order: 0,
        visible: true,
        fields: [
          { label: "Norma", value: "CPSC / EN 1078", order: 0, visible: true },
          { label: "Oculta", value: "No debe verse", order: 1, visible: false },
          { label: "Sin llenar", value: "", order: 2, visible: true },
        ],
      },
      {
        title: "Apartado oculto",
        order: 1,
        visible: false,
        fields: [{ label: "Peso", value: "250 g", order: 0, visible: true }],
      },
    ];

    it("keeps every row in the admin DTO but withholds the hidden/blank ones from the storefront", async () => {
      const created = await request(app)
        .post(`${ADMIN}/accessories`)
        .set("Cookie", adminCookie)
        .send(accessoryPayload(categoryId, brandId));
      const id = created.body.data.accessory.id as string;

      await request(app).put(`${ADMIN}/accessories/${id}/spec-groups`).set("Cookie", adminCookie).send({ groups: MIXED_GROUPS });

      const admin = await request(app).get(`${ADMIN}/accessories/${id}`).set("Cookie", adminCookie);
      const adminGroups = admin.body.data.accessory.specGroups as typeof MIXED_GROUPS;
      expect(adminGroups).toHaveLength(2);
      expect(adminGroups[1]?.visible).toBe(false);
      expect(adminGroups[0]?.fields[1]?.visible).toBe(false);
      expect(adminGroups[0]?.fields[2]?.value).toBe("");

      const stored = await Accessory.findById(id).exec();
      const publicResponse = await request(app).get(`${PUBLIC}/accessories/${stored!.slug}`);
      const publicGroups = publicResponse.body.data.accessory.specGroups as typeof MIXED_GROUPS;
      // "Apartado oculto" is gone entirely; "Certificaciones" keeps only the
      // row that is both visible and filled in.
      expect(publicGroups).toHaveLength(1);
      expect(publicGroups[0]?.title).toBe("Certificaciones");
      expect(publicGroups[0]?.fields).toHaveLength(1);
      expect(publicGroups[0]?.fields[0]?.label).toBe("Norma");
    });
  });
});
