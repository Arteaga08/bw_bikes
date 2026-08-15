import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { MAX_SIZE_TEMPLATES, SizeTemplate } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

describe("size template CRUD", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  it("runs the full create/read/update/delete cycle over the API", async () => {
    const created = await request(app)
      .post(`${ADMIN}/size-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "54" });

    expect(created.status).toBe(201);
    expect(created.body.data.sizeTemplate.source).toBe("manual");
    expect(created.body.data.sizeTemplate.value).toBe("54");
    const id = created.body.data.sizeTemplate.id as string;

    const read = await request(app).get(`${ADMIN}/size-templates/${id}`).set("Cookie", adminCookie);
    expect(read.status).toBe(200);
    expect(read.body.data.sizeTemplate.value).toBe("54");

    const updated = await request(app)
      .patch(`${ADMIN}/size-templates/${id}`)
      .set("Cookie", adminCookie)
      .send({ value: "56" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.sizeTemplate.value).toBe("56");

    const removed = await request(app).delete(`${ADMIN}/size-templates/${id}`).set("Cookie", adminCookie);
    expect(removed.status).toBe(200);
    expect(await SizeTemplate.countDocuments()).toBe(0);
  });

  it("rejects a duplicate value (case-insensitive) with 409", async () => {
    await request(app).post(`${ADMIN}/size-templates`).set("Cookie", adminCookie).send({ value: "M" });

    const duplicate = await request(app).post(`${ADMIN}/size-templates`).set("Cookie", adminCookie).send({ value: "m" });

    expect(duplicate.status).toBe(409);
  });

  it("rejects creating past the MAX_SIZE_TEMPLATES cap", async () => {
    await SizeTemplate.insertMany(
      Array.from({ length: MAX_SIZE_TEMPLATES }, (_, index) => ({
        value: `T${index}`,
        source: "manual",
        order: index,
      })),
    );

    const response = await request(app).post(`${ADMIN}/size-templates`).set("Cookie", adminCookie).send({ value: "Extra" });

    expect(response.status).toBe(400);
    expect(await SizeTemplate.countDocuments()).toBe(MAX_SIZE_TEMPLATES);
  });
});

describe("learning sizes from a product's variants", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let categoryId: string;
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const [category, brand] = await Promise.all([createBikeCategoryDoc(), createBrandDoc()]);
    categoryId = String(category._id);
    brandId = String(brand._id);
  });

  function createBike(variants: unknown) {
    return request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send({
      name: "Tarmac SL8",
      brand: brandId,
      category: categoryId,
      shortDescription: "Bici de ruta",
      description: "Descripción",
      price: 19_999_900,
      variants,
    });
  }

  it("creates an auto template for each distinct size the first time a bike saves its variants", async () => {
    const response = await createBike([
      { sku: "TRM-54", size: "54", fulfillmentMode: "in_stock" },
      { sku: "TRM-56", size: "56", fulfillmentMode: "in_stock" },
      // Repeats "54" — must not create a duplicate template.
      { sku: "TRM-54-NEG", size: "54", color: "Negro", fulfillmentMode: "in_stock" },
    ]);
    expect(response.status).toBe(201);

    const templates = await SizeTemplate.find({}).sort({ value: 1 }).exec();
    expect(templates.map((t) => t.value)).toEqual(["54", "56"]);
    expect(templates.every((t) => t.source === "auto")).toBe(true);
  });

  it("never downgrades a manual template to auto when a product reuses its value", async () => {
    await request(app).post(`${ADMIN}/size-templates`).set("Cookie", adminCookie).send({ value: "M" });

    await createBike([{ sku: "TRM-M", size: "M", fulfillmentMode: "in_stock" }]);

    const templates = await SizeTemplate.find({ value: "M" }).exec();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.source).toBe("manual");
  });

  it("a variant with no size is never learned", async () => {
    const response = await createBike([{ sku: "TRM-NOSIZE", fulfillmentMode: "in_stock" }]);
    expect(response.status).toBe(201);
    expect(await SizeTemplate.countDocuments()).toBe(0);
  });

  it("also learns on update, since variants ride the product's own PATCH", async () => {
    const created = await createBike([{ sku: "TRM-54", size: "54", fulfillmentMode: "in_stock" }]);
    const bikeId = created.body.data.bike.id as string;
    expect(await SizeTemplate.countDocuments()).toBe(1);

    const updated = await request(app)
      .patch(`${ADMIN}/bikes/${bikeId}`)
      .set("Cookie", adminCookie)
      .send({
        variants: [
          { sku: "TRM-54", size: "54", fulfillmentMode: "in_stock" },
          { sku: "TRM-58", size: "58", fulfillmentMode: "in_stock" },
        ],
      });
    expect(updated.status).toBe(200);

    const templates = await SizeTemplate.find({}).sort({ value: 1 }).exec();
    expect(templates.map((t) => t.value)).toEqual(["54", "58"]);
  });
});
