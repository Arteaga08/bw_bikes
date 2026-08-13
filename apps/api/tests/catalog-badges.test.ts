import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Badge, Bike } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

describe("badge CRUD", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  it("runs the full create/read/update/delete cycle over the API", async () => {
    const created = await request(app)
      .post(`${ADMIN}/badges`)
      .set("Cookie", adminCookie)
      .send({ label: "Novedad", variant: "accent" });

    expect(created.status).toBe(201);
    expect(created.body.data.badge.slug).toBe("novedad");
    expect(created.body.data.badge.variant).toBe("accent");
    const id = created.body.data.badge.id as string;

    const read = await request(app).get(`${ADMIN}/badges/${id}`).set("Cookie", adminCookie);
    expect(read.status).toBe(200);
    expect(read.body.data.badge.label).toBe("Novedad");

    const updated = await request(app)
      .patch(`${ADMIN}/badges/${id}`)
      .set("Cookie", adminCookie)
      .send({ variant: "exito", isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data.badge.variant).toBe("exito");
    expect(updated.body.data.badge.isActive).toBe(false);

    const removed = await request(app).delete(`${ADMIN}/badges/${id}`).set("Cookie", adminCookie);
    expect(removed.status).toBe(200);
    expect(await Badge.countDocuments()).toBe(0);
  });

  it("rejects a duplicate label with 409", async () => {
    await request(app).post(`${ADMIN}/badges`).set("Cookie", adminCookie).send({ label: "Bestseller", variant: "exito" });

    const duplicate = await request(app)
      .post(`${ADMIN}/badges`)
      .set("Cookie", adminCookie)
      .send({ label: "Bestseller", variant: "accent" });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toContain("Bestseller");
  });

  it("rejects a variant outside the closed set with 400", async () => {
    const response = await request(app)
      .post(`${ADMIN}/badges`)
      .set("Cookie", adminCookie)
      .send({ label: "Oferta", variant: "dorado-brillante" });

    expect(response.status).toBe(400);
  });

  it("refuses to delete a badge still assigned to a product", async () => {
    const badge = await request(app).post(`${ADMIN}/badges`).set("Cookie", adminCookie).send({ label: "Agotado", variant: "unavailable" });
    const badgeId = badge.body.data.badge.id as string;

    const [category, brand] = await Promise.all([createBikeCategoryDoc(), createBrandDoc()]);
    await Bike.create({
      name: "Tarmac SL8",
      slug: "tarmac-sl8-badge-test",
      brand: brand._id,
      category: category._id,
      shortDescription: "Bici de ruta",
      description: "Descripción",
      price: 19_999_900,
      badges: [badgeId],
    });

    const removed = await request(app).delete(`${ADMIN}/badges/${badgeId}`).set("Cookie", adminCookie);

    expect(removed.status).toBe(409);
    expect(removed.body.message).toContain("producto");
    expect(await Badge.countDocuments()).toBe(1);
  });
});

describe("assigning badges to a product", () => {
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

  function bikePayload(overrides: Record<string, unknown> = {}) {
    return {
      name: "Tarmac SL8 Pro",
      brand: brandId,
      category: categoryId,
      shortDescription: "Bici de ruta de alto rendimiento.",
      description: "Cuadro de carbono FACT 10r.",
      price: 19_999_900,
      ...overrides,
    };
  }

  async function createBadgeIds(count: number, overrides: { isActive?: boolean } = {}): Promise<string[]> {
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const response = await request(app)
        .post(`${ADMIN}/badges`)
        .set("Cookie", adminCookie)
        .send({ label: `Badge ${index}-${Math.random().toString(16).slice(2, 6)}`, variant: "accent", ...overrides });
      ids.push(response.body.data.badge.id as string);
    }
    return ids;
  }

  it("assigns the one allowed badge and resolves it on the admin DTO", async () => {
    const badgeIds = await createBadgeIds(1);

    const created = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload({ badges: badgeIds }));
    expect(created.status).toBe(201);
    const id = created.body.data.bike.id as string;

    // The create response itself isn't populated (same as `relatedAccessories`)
    // — resolved badges only show up on a fresh read.
    const read = await request(app).get(`${ADMIN}/bikes/${id}`).set("Cookie", adminCookie);
    expect(read.body.data.bike.badges).toHaveLength(1);
    expect(read.body.data.bike.badges[0].id).toBe(badgeIds[0]);
  });

  it("rejects a second badge with 400", async () => {
    const badgeIds = await createBadgeIds(2);

    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload({ badges: badgeIds }));

    expect(response.status).toBe(400);
  });

  it("rejects a nonexistent badge with 404", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload({ badges: ["507f1f77bcf86cd799439011"] }));

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("badge");
  });

  it("the public PDP drops a badge that was deactivated after being assigned, the admin view keeps it", async () => {
    const [badgeId] = await createBadgeIds(1);

    const created = await request(app)
      .post(`${ADMIN}/bikes`)
      .set("Cookie", adminCookie)
      .send(bikePayload({ badges: [badgeId] }));
    const id = created.body.data.bike.id as string;

    await request(app).patch(`${ADMIN}/badges/${badgeId}`).set("Cookie", adminCookie).send({ isActive: false });

    const pdp = await request(app).get(`${PUBLIC}/bikes/tarmac-sl8-pro`);
    expect(pdp.status).toBe(200);
    expect(pdp.body.data.bike.badges).toHaveLength(0);

    const adminRead = await request(app).get(`${ADMIN}/bikes/${id}`).set("Cookie", adminCookie);
    expect(adminRead.body.data.bike.badges).toHaveLength(1);
    expect(adminRead.body.data.bike.badges[0].id).toBe(badgeId);
  });
});
