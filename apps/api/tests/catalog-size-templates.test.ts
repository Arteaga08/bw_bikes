import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import {
  AccessoryCategory,
  AccessorySizeTemplate,
  BikeCategory,
  BikeSizeTemplate,
  MAX_SIZE_TEMPLATES,
} from "../src/models/index.js";
import { resolveHeightRange } from "../src/services/size-template.service.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

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

describe("resolveHeightRange", () => {
  it("falls back through exact override → parent override → base range → undefined", () => {
    const template = {
      heightRange: { minHeightCm: 170, maxHeightCm: 178 },
      categoryOverrides: [
        { categoryId: "root-category", minHeightCm: 165, maxHeightCm: 172 },
        { categoryId: "child-category", minHeightCm: 168, maxHeightCm: 175 },
      ],
    };

    // Exact match wins over everything else.
    expect(resolveHeightRange(template, "child-category", "root-category")).toEqual({
      minHeightCm: 168,
      maxHeightCm: 175,
    });

    // No exact match, but the parent has one.
    expect(resolveHeightRange(template, "grandchild-category", "root-category")).toEqual({
      minHeightCm: 165,
      maxHeightCm: 172,
    });

    // Neither the category nor its parent has an override — falls back to the base range.
    expect(resolveHeightRange(template, "unrelated-category", "another-unrelated-category")).toEqual({
      minHeightCm: 170,
      maxHeightCm: 178,
    });

    // No base range and no matching override at all.
    expect(
      resolveHeightRange({ heightRange: undefined, categoryOverrides: [] }, "unrelated-category"),
    ).toBeUndefined();
  });
});

describe("bike size guide", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let rootCategoryId: string;
  let childCategoryId: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
    const root = await createBikeCategoryDoc({ name: "Ruta" });
    rootCategoryId = String(root._id);
    const child = await BikeCategory.create({
      name: "Ruta Endurance",
      slug: `ruta-endurance-${Math.random().toString(16).slice(2, 8)}`,
      parent: root._id,
      isActive: true,
    });
    childCategoryId = String(child._id);
  });

  it("omits a size with no height data at all", async () => {
    await BikeSizeTemplate.create({ value: "M", source: "manual", order: 0 });

    const response = await request(app).get(`${PUBLIC}/bike-size-guide?categoryId=${rootCategoryId}`);
    expect(response.status).toBe(200);
    expect(response.body.data.sizeGuide).toEqual([]);
  });

  it("uses the base height range when there's no category override", async () => {
    await BikeSizeTemplate.create({
      value: "M",
      source: "manual",
      order: 0,
      heightRange: { minHeightCm: 170, maxHeightCm: 178 },
    });

    const response = await request(app).get(`${PUBLIC}/bike-size-guide?categoryId=${rootCategoryId}`);
    expect(response.status).toBe(200);
    expect(response.body.data.sizeGuide).toEqual([{ value: "M", minHeightCm: 170, maxHeightCm: 178 }]);
  });

  it("prefers a category override over the base range, and a child category inherits its parent's override", async () => {
    await BikeSizeTemplate.create({
      value: "M",
      source: "manual",
      order: 0,
      heightRange: { minHeightCm: 170, maxHeightCm: 178 },
      categoryOverrides: [{ categoryId: rootCategoryId, minHeightCm: 165, maxHeightCm: 172 }],
    });

    const rootGuide = await request(app).get(`${PUBLIC}/bike-size-guide?categoryId=${rootCategoryId}`);
    expect(rootGuide.body.data.sizeGuide).toEqual([{ value: "M", minHeightCm: 165, maxHeightCm: 172 }]);

    // "Ruta Endurance" has no override of its own, but its parent ("Ruta") does.
    const childGuide = await request(app).get(`${PUBLIC}/bike-size-guide?categoryId=${childCategoryId}`);
    expect(childGuide.body.data.sizeGuide).toEqual([{ value: "M", minHeightCm: 165, maxHeightCm: 172 }]);
  });

  it("excludes an inactive size even when it has a height range", async () => {
    await BikeSizeTemplate.create({
      value: "S",
      source: "manual",
      order: 0,
      isActive: false,
      heightRange: { minHeightCm: 160, maxHeightCm: 168 },
    });

    const response = await request(app).get(`${PUBLIC}/bike-size-guide?categoryId=${rootCategoryId}`);
    expect(response.body.data.sizeGuide).toEqual([]);
  });

  it("404s for a category that doesn't exist", async () => {
    const response = await request(app).get(`${PUBLIC}/bike-size-guide?categoryId=000000000000000000000000`);
    expect(response.status).toBe(404);
  });

  it("400s without a categoryId", async () => {
    const response = await request(app).get(`${PUBLIC}/bike-size-guide`);
    expect(response.status).toBe(400);
  });

  it("rejects a height range where max isn't greater than min", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bike-size-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "M", heightRange: { minHeightCm: 178, maxHeightCm: 178 } });

    expect(response.status).toBe(400);
  });

  it("rejects an incomplete height range (only one bound sent)", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bike-size-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "M", heightRange: { minHeightCm: 170 } });

    expect(response.status).toBe(400);
  });

  it("rejects two category overrides for the same category", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bike-size-templates`)
      .set("Cookie", adminCookie)
      .send({
        value: "M",
        categoryOverrides: [
          { categoryId: rootCategoryId, minHeightCm: 165, maxHeightCm: 172 },
          { categoryId: rootCategoryId, minHeightCm: 168, maxHeightCm: 175 },
        ],
      });

    expect(response.status).toBe(400);
  });

  it("persists a height range and a category override end to end through the admin CRUD", async () => {
    const created = await request(app)
      .post(`${ADMIN}/bike-size-templates`)
      .set("Cookie", adminCookie)
      .send({
        value: "M",
        heightRange: { minHeightCm: 170, maxHeightCm: 178 },
        categoryOverrides: [{ categoryId: rootCategoryId, minHeightCm: 165, maxHeightCm: 172 }],
      });

    expect(created.status).toBe(201);
    expect(created.body.data.sizeTemplate.heightRange).toEqual({ minHeightCm: 170, maxHeightCm: 178 });
    expect(created.body.data.sizeTemplate.categoryOverrides).toEqual([
      { categoryId: rootCategoryId, minHeightCm: 165, maxHeightCm: 172 },
    ]);

    const id = created.body.data.sizeTemplate.id as string;
    const read = await request(app).get(`${ADMIN}/bike-size-templates/${id}`).set("Cookie", adminCookie);
    expect(read.body.data.sizeTemplate.heightRange).toEqual({ minHeightCm: 170, maxHeightCm: 178 });
  });

  /**
   * Regression: `categoryOverrides` postdates every size template already in
   * the database, so a size saved before this migration has no such field on
   * its raw Mongo document — `insertOne` on the native collection, bypassing
   * Mongoose entirely, is what actually reproduces that (an `insertMany`
   * through the model would apply the schema's own `default: []` and hide
   * the bug). `list()`'s `.lean()` reads skip Mongoose's hydration too, so it
   * never backfills the default either — `toSizeTemplateDto` used to call
   * `.map()` straight on the missing field and 500 the entire admin bike
   * editor, which loads this list alongside the bike itself.
   */
  it("lists a pre-existing size template that predates categoryOverrides without 500ing", async () => {
    await BikeSizeTemplate.collection.insertOne({
      value: "M",
      source: "manual",
      order: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app).get(`${ADMIN}/bike-size-templates`).set("Cookie", adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.data.sizeTemplates).toEqual([
      expect.objectContaining({ value: "M", categoryOverrides: [] }),
    ]);
  });

  it("resolves the bike size guide for a pre-existing size template that predates categoryOverrides", async () => {
    await BikeSizeTemplate.collection.insertOne({
      value: "M",
      source: "manual",
      order: 0,
      isActive: true,
      heightRange: { minHeightCm: 170, maxHeightCm: 178 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app).get(`${PUBLIC}/bike-size-guide?categoryId=${rootCategoryId}`);
    expect(response.status).toBe(200);
    expect(response.body.data.sizeGuide).toEqual([{ value: "M", minHeightCm: 170, maxHeightCm: 178 }]);
  });
});
