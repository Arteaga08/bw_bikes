import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AccessoryCategory, AccessorySizeTemplate, BikeSizeTemplate, MAX_SIZE_TEMPLATES } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

describe("size template CRUD (both trees)", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  it("runs the full create/read/update/delete cycle over the API", async () => {
    const created = await request(app)
      .post(`${ADMIN}/bike-size-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "54" });

    expect(created.status).toBe(201);
    expect(created.body.data.sizeTemplate.source).toBe("manual");
    expect(created.body.data.sizeTemplate.value).toBe("54");
    const id = created.body.data.sizeTemplate.id as string;

    const read = await request(app).get(`${ADMIN}/bike-size-templates/${id}`).set("Cookie", adminCookie);
    expect(read.status).toBe(200);
    expect(read.body.data.sizeTemplate.value).toBe("54");

    const updated = await request(app)
      .patch(`${ADMIN}/bike-size-templates/${id}`)
      .set("Cookie", adminCookie)
      .send({ value: "56" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.sizeTemplate.value).toBe("56");

    const removed = await request(app).delete(`${ADMIN}/bike-size-templates/${id}`).set("Cookie", adminCookie);
    expect(removed.status).toBe(200);
    expect(await BikeSizeTemplate.countDocuments()).toBe(0);
  });

  it("rejects a duplicate value (case-insensitive) with 409", async () => {
    await request(app).post(`${ADMIN}/bike-size-templates`).set("Cookie", adminCookie).send({ value: "M" });

    const duplicate = await request(app)
      .post(`${ADMIN}/bike-size-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "m" });

    expect(duplicate.status).toBe(409);
  });

  it("rejects creating past the MAX_SIZE_TEMPLATES cap", async () => {
    await BikeSizeTemplate.insertMany(
      Array.from({ length: MAX_SIZE_TEMPLATES }, (_, index) => ({
        value: `T${index}`,
        source: "manual",
        order: index,
      })),
    );

    const response = await request(app)
      .post(`${ADMIN}/bike-size-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "Extra" });

    expect(response.status).toBe(400);
    expect(await BikeSizeTemplate.countDocuments()).toBe(MAX_SIZE_TEMPLATES);
  });

  it("keeps the two catalogs independent: the same value is free in each, and a full bike catalog doesn't block the accessory one", async () => {
    const bikeCreated = await request(app)
      .post(`${ADMIN}/bike-size-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "M" });
    expect(bikeCreated.status).toBe(201);

    // "M" is free in the accessory catalog even though it's already taken in the bike one.
    const accessoryCreated = await request(app)
      .post(`${ADMIN}/accessory-size-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "M" });
    expect(accessoryCreated.status).toBe(201);

    expect(await BikeSizeTemplate.countDocuments()).toBe(1);
    expect(await AccessorySizeTemplate.countDocuments()).toBe(1);

    await BikeSizeTemplate.insertMany(
      Array.from({ length: MAX_SIZE_TEMPLATES - 1 }, (_, index) => ({
        value: `BT${index}`,
        source: "manual",
        order: index,
      })),
    );
    const bikeAtCap = await request(app)
      .post(`${ADMIN}/bike-size-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "Extra" });
    expect(bikeAtCap.status).toBe(400);

    // The bike catalog being at its cap doesn't affect the accessory one.
    const accessoryStillFree = await request(app)
      .post(`${ADMIN}/accessory-size-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "L" });
    expect(accessoryStillFree.status).toBe(201);
  });
});

describe("learning sizes from a product's variants", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let bikeCategoryId: string;
  let accessoryCategoryId: string;
  let brandId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const [bikeCategory, accessoryCategory, brand] = await Promise.all([
      createBikeCategoryDoc(),
      AccessoryCategory.create({ name: "Cascos", slug: `cascos-${Math.random().toString(16).slice(2, 8)}`, isActive: true }),
      createBrandDoc(),
    ]);
    bikeCategoryId = String(bikeCategory._id);
    accessoryCategoryId = String(accessoryCategory._id);
    brandId = String(brand._id);
  });

  function createBike(variants: unknown) {
    return request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send({
      name: "Tarmac SL8",
      brand: brandId,
      category: bikeCategoryId,
      shortDescription: "Bici de ruta",
      description: "Descripción",
      price: 19_999_900,
      variants,
    });
  }

  function createAccessory(variants: unknown) {
    return request(app).post(`${ADMIN}/accessories`).set("Cookie", adminCookie).send({
      name: "Casco Aero",
      brand: brandId,
      category: accessoryCategoryId,
      description: "Descripción",
      price: 4_500_00,
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

    const templates = await BikeSizeTemplate.find({}).sort({ value: 1 }).exec();
    expect(templates.map((t) => t.value)).toEqual(["54", "56"]);
    expect(templates.every((t) => t.source === "auto")).toBe(true);
    expect(await AccessorySizeTemplate.countDocuments()).toBe(0);
  });

  it("creates an auto template for each distinct size the first time an accessory saves its variants, in its own catalog", async () => {
    const response = await createAccessory([
      { sku: "CSC-M", size: "M", fulfillmentMode: "in_stock" },
      { sku: "CSC-L", size: "L", fulfillmentMode: "in_stock" },
    ]);
    expect(response.status).toBe(201);

    const templates = await AccessorySizeTemplate.find({}).sort({ value: 1 }).exec();
    expect(templates.map((t) => t.value)).toEqual(["L", "M"]);
    expect(templates.every((t) => t.source === "auto")).toBe(true);
    expect(await BikeSizeTemplate.countDocuments()).toBe(0);
  });

  it("never downgrades a manual template to auto when a product reuses its value", async () => {
    await request(app).post(`${ADMIN}/bike-size-templates`).set("Cookie", adminCookie).send({ value: "M" });

    await createBike([{ sku: "TRM-M", size: "M", fulfillmentMode: "in_stock" }]);

    const templates = await BikeSizeTemplate.find({ value: "M" }).exec();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.source).toBe("manual");
  });

  it("a variant with no size is never learned", async () => {
    const response = await createBike([{ sku: "TRM-NOSIZE", fulfillmentMode: "in_stock" }]);
    expect(response.status).toBe(201);
    expect(await BikeSizeTemplate.countDocuments()).toBe(0);
  });

  it("also learns on update, since variants ride the product's own PATCH", async () => {
    const created = await createBike([{ sku: "TRM-54", size: "54", fulfillmentMode: "in_stock" }]);
    const bikeId = created.body.data.bike.id as string;
    expect(await BikeSizeTemplate.countDocuments()).toBe(1);

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

    const templates = await BikeSizeTemplate.find({}).sort({ value: 1 }).exec();
    expect(templates.map((t) => t.value)).toEqual(["54", "58"]);
  });
});
