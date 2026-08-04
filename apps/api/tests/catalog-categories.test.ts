import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AccessoryCategory, Bike, BikeCategory } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

describe("category CRUD (both trees)", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  it("runs the full create/read/update/delete cycle over the API", async () => {
    const created = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Bicicletas de Montaña", order: 1 });

    expect(created.status).toBe(201);
    // Slug derived from the name, accents folded — see utils/slugify.ts.
    expect(created.body.data.category.slug).toBe("bicicletas-de-montana");
    const id = created.body.data.category._id as string;

    const read = await request(app).get(`${ADMIN}/bike-categories/${id}`).set("Cookie", adminCookie);
    expect(read.status).toBe(200);
    expect(read.body.data.category.name).toBe("Bicicletas de Montaña");

    const updated = await request(app)
      .patch(`${ADMIN}/bike-categories/${id}`)
      .set("Cookie", adminCookie)
      .send({ name: "Montaña", order: 3 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.category.name).toBe("Montaña");
    expect(updated.body.data.category.order).toBe(3);

    const removed = await request(app).delete(`${ADMIN}/bike-categories/${id}`).set("Cookie", adminCookie);
    expect(removed.status).toBe(200);
    expect(await BikeCategory.countDocuments()).toBe(0);
  });

  it("keeps the two trees independent: the same slug is free in each", async () => {
    const bikeSide = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Cascos" });
    const accessorySide = await request(app)
      .post(`${ADMIN}/accessory-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Cascos" });

    expect(bikeSide.status).toBe(201);
    expect(accessorySide.status).toBe(201);
    expect(bikeSide.body.data.category.slug).toBe("cascos");
    expect(accessorySide.body.data.category.slug).toBe("cascos");

    expect(await BikeCategory.countDocuments()).toBe(1);
    expect(await AccessoryCategory.countDocuments()).toBe(1);
  });

  it("rejects a duplicate slug inside the same tree with 409", async () => {
    await request(app).post(`${ADMIN}/bike-categories`).set("Cookie", adminCookie).send({ name: "Ruta" });

    const duplicate = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Ruta" });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toContain("ruta");
  });
});

describe("two-level hierarchy", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  it("allows a child under a root but rejects a third level with 400", async () => {
    const root = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Montaña" });
    const rootId = root.body.data.category._id as string;

    const child = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Doble suspensión", parent: rootId });
    expect(child.status).toBe(201);
    const childId = child.body.data.category._id as string;

    const grandchild = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Enduro", parent: childId });

    expect(grandchild.status).toBe(400);
    expect(grandchild.body.message).toContain("dos niveles");
  });

  it("rejects re-parenting a category that already has children", async () => {
    const rootA = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Montaña" });
    const rootB = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Ruta" });

    await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Enduro", parent: rootA.body.data.category._id });

    // Moving A (which has a child) under B would create a third level.
    const moved = await request(app)
      .patch(`${ADMIN}/bike-categories/${rootA.body.data.category._id}`)
      .set("Cookie", adminCookie)
      .send({ parent: rootB.body.data.category._id });

    expect(moved.status).toBe(400);
    expect(moved.body.message).toContain("dos niveles");
  });

  it("returns roots with their children resolved from /tree", async () => {
    const root = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Montaña" });
    await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Enduro", parent: root.body.data.category._id, order: 1 });
    await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Cross Country", parent: root.body.data.category._id, order: 0 });

    const tree = await request(app).get(`${PUBLIC}/bike-categories/tree`);

    expect(tree.status).toBe(200);
    expect(tree.body.data.tree).toHaveLength(1);
    expect(tree.body.data.tree[0].children.map((child: { name: string }) => child.name)).toEqual([
      "Cross Country",
      "Enduro",
    ]);
  });
});

describe("deleting a category", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  it("refuses with 409 when the category still has subcategories", async () => {
    const root = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Montaña" });
    const rootId = root.body.data.category._id as string;
    await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Enduro", parent: rootId });

    const removed = await request(app).delete(`${ADMIN}/bike-categories/${rootId}`).set("Cookie", adminCookie);

    expect(removed.status).toBe(409);
    expect(removed.body.message).toContain("subcategoría");
    expect(await BikeCategory.countDocuments()).toBe(2);
  });

  it("refuses with 409 when products still point at the category", async () => {
    const category = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Ruta" });
    const categoryId = category.body.data.category._id as string;

    await Bike.create({
      name: "Tarmac SL8",
      slug: "tarmac-sl8",
      brand: "Specialized",
      category: categoryId,
      shortDescription: "Bici de ruta",
      description: "Descripción",
      price: 19_999_900,
      brakeType: "hydraulic_disc",
    });

    const removed = await request(app)
      .delete(`${ADMIN}/bike-categories/${categoryId}`)
      .set("Cookie", adminCookie);

    expect(removed.status).toBe(409);
    expect(removed.body.message).toContain("producto");
  });
});

describe("public category reads", () => {
  it("hides inactive categories from the public list and detail", async () => {
    const app = buildApp();
    await BikeCategory.create({ name: "Visible", slug: "visible", isActive: true });
    await BikeCategory.create({ name: "Oculta", slug: "oculta", isActive: false });

    const list = await request(app).get(`${PUBLIC}/bike-categories`);
    expect(list.status).toBe(200);
    expect(list.body.data.categories).toHaveLength(1);
    expect(list.body.data.categories[0].slug).toBe("visible");

    const hidden = await request(app).get(`${PUBLIC}/bike-categories/oculta`);
    expect(hidden.status).toBe(404);
  });
});
