import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AccessoryCategory, Bike, BikeCategory } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { stubCloudinary } from "./helpers/cloudinary.js";
import { createBrandDoc } from "./helpers/factories.js";
import { makeJpegBuffer, makePngBuffer } from "./helpers/images.js";

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
    const id = created.body.data.category.id as string;

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
    const rootId = root.body.data.category.id as string;

    const child = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Doble suspensión", parent: rootId });
    expect(child.status).toBe(201);
    const childId = child.body.data.category.id as string;

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
      .send({ name: "Enduro", parent: rootA.body.data.category.id });

    // Moving A (which has a child) under B would create a third level.
    const moved = await request(app)
      .patch(`${ADMIN}/bike-categories/${rootA.body.data.category.id}`)
      .set("Cookie", adminCookie)
      .send({ parent: rootB.body.data.category.id });

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
      .send({ name: "Enduro", parent: root.body.data.category.id, order: 1 });
    await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Cross Country", parent: root.body.data.category.id, order: 0 });

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
    const rootId = root.body.data.category.id as string;
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
    const categoryId = category.body.data.category.id as string;

    await Bike.create({
      name: "Tarmac SL8",
      slug: "tarmac-sl8",
      brand: (await createBrandDoc())._id,
      category: categoryId,
      shortDescription: "Bici de ruta",
      description: "Descripción",
      price: 19_999_900,
    });

    const removed = await request(app)
      .delete(`${ADMIN}/bike-categories/${categoryId}`)
      .set("Cookie", adminCookie);

    expect(removed.status).toBe(409);
    expect(removed.body.message).toContain("producto");
  });
});

describe("admin DTO shape (M10)", () => {
  it("exposes isActive and timestamps in the admin list and tree, unlike the public DTO", async () => {
    const app = buildApp();
    const adminCookie = await createAdminSession(app);

    const active = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Activa" });
    await request(app)
      .patch(`${ADMIN}/bike-categories/${active.body.data.category.id}`)
      .set("Cookie", adminCookie)
      .send({ isActive: false });

    const list = await request(app).get(`${ADMIN}/bike-categories`).set("Cookie", adminCookie);
    expect(list.status).toBe(200);
    expect(list.body.data.categories[0].isActive).toBe(false);
    expect(list.body.data.categories[0].createdAt).toEqual(expect.any(String));

    const tree = await request(app).get(`${ADMIN}/bike-categories/tree`).set("Cookie", adminCookie);
    expect(tree.status).toBe(200);
    // Inactive categories are excluded from the *public* tree but not the admin one.
    expect(tree.body.data.tree).toHaveLength(1);
    expect(tree.body.data.tree[0].isActive).toBe(false);

    const publicList = await request(app).get(`${PUBLIC}/bike-categories`);
    expect(publicList.body.data.categories).toHaveLength(0);
    expect(publicList.body.data.categories.every((category: object) => !("isActive" in category))).toBe(true);
  });
});

describe("category image (M10.2)", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let cloudinary: ReturnType<typeof stubCloudinary>;
  let categoryId: string;

  beforeEach(async () => {
    app = buildApp();
    cloudinary = stubCloudinary();
    adminCookie = await createAdminSession(app);

    const created = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Montaña" });
    categoryId = created.body.data.category.id as string;
  });

  it("uploads an image and the admin GET brings it back", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bike-categories/${categoryId}/image`)
      .set("Cookie", adminCookie)
      .attach("images", await makeJpegBuffer(), { filename: "montana.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(200);
    expect(cloudinary.uploadSpy).toHaveBeenCalledTimes(1);
    expect(response.body.data.category.image.publicId).toContain("bw-bikes/bike-categories/");

    const read = await request(app).get(`${ADMIN}/bike-categories/${categoryId}`).set("Cookie", adminCookie);
    expect(read.body.data.category.image.publicId).toBe(response.body.data.category.image.publicId);
  });

  it("replacing the image deletes the previous Cloudinary asset", async () => {
    const first = await request(app)
      .post(`${ADMIN}/bike-categories/${categoryId}/image`)
      .set("Cookie", adminCookie)
      .attach("images", await makeJpegBuffer(), { filename: "primera.jpg", contentType: "image/jpeg" });
    const firstPublicId = first.body.data.category.image.publicId as string;

    const second = await request(app)
      .post(`${ADMIN}/bike-categories/${categoryId}/image`)
      .set("Cookie", adminCookie)
      .attach("images", await makePngBuffer(), { filename: "segunda.png", contentType: "image/png" });

    expect(second.status).toBe(200);
    expect(second.body.data.category.image.publicId).not.toBe(firstPublicId);
    expect(cloudinary.destroySpy).toHaveBeenCalledWith(firstPublicId, { resource_type: "image" });
  });

  it("rejects more than one file in the same request", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bike-categories/${categoryId}/image`)
      .set("Cookie", adminCookie)
      .attach("images", await makeJpegBuffer(), { filename: "a.jpg", contentType: "image/jpeg" })
      .attach("images", await makeJpegBuffer(), { filename: "b.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(400);
    expect(cloudinary.uploadSpy).not.toHaveBeenCalled();
  });

  it("removes the image and deletes the Cloudinary asset", async () => {
    const uploaded = await request(app)
      .post(`${ADMIN}/bike-categories/${categoryId}/image`)
      .set("Cookie", adminCookie)
      .attach("images", await makeJpegBuffer(), { filename: "montana.jpg", contentType: "image/jpeg" });
    const publicId = uploaded.body.data.category.image.publicId as string;

    const removed = await request(app)
      .delete(`${ADMIN}/bike-categories/${categoryId}/image`)
      .set("Cookie", adminCookie);

    expect(removed.status).toBe(200);
    expect(removed.body.data.category.image).toBeUndefined();
    expect(cloudinary.destroySpy).toHaveBeenCalledWith(publicId, { resource_type: "image" });
  });

  it("rejects removing an image the category doesn't have with 409", async () => {
    const response = await request(app)
      .delete(`${ADMIN}/bike-categories/${categoryId}/image`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(409);
    expect(cloudinary.destroySpy).not.toHaveBeenCalled();
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
