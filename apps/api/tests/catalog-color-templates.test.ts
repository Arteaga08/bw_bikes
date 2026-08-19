import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AccessoryCategory, ColorTemplate, MAX_COLOR_TEMPLATES } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

describe("color template CRUD (one shared collection)", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    adminCookie = await createAdminSession(app);
  });

  it("runs the full create/read/update/delete cycle over the API", async () => {
    const created = await request(app)
      .post(`${ADMIN}/color-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "Negro mate", hex: "#0A0A0A" });

    expect(created.status).toBe(201);
    expect(created.body.data.colorTemplate.source).toBe("manual");
    expect(created.body.data.colorTemplate.value).toBe("Negro mate");
    expect(created.body.data.colorTemplate.hex).toBe("#0A0A0A");
    const id = created.body.data.colorTemplate.id as string;

    const read = await request(app).get(`${ADMIN}/color-templates/${id}`).set("Cookie", adminCookie);
    expect(read.status).toBe(200);
    expect(read.body.data.colorTemplate.value).toBe("Negro mate");

    const updated = await request(app)
      .patch(`${ADMIN}/color-templates/${id}`)
      .set("Cookie", adminCookie)
      .send({ hex: "#111111" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.colorTemplate.hex).toBe("#111111");

    const removed = await request(app).delete(`${ADMIN}/color-templates/${id}`).set("Cookie", adminCookie);
    expect(removed.status).toBe(200);
    expect(await ColorTemplate.countDocuments()).toBe(0);
  });

  it("rejects creating without a hex value", async () => {
    const response = await request(app).post(`${ADMIN}/color-templates`).set("Cookie", adminCookie).send({ value: "Azul" });
    expect(response.status).toBe(400);
  });

  it("rejects a malformed hex value", async () => {
    const response = await request(app)
      .post(`${ADMIN}/color-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "Azul", hex: "blue" });
    expect(response.status).toBe(400);
  });

  it("rejects a duplicate value (case-insensitive) with 409", async () => {
    await request(app).post(`${ADMIN}/color-templates`).set("Cookie", adminCookie).send({ value: "Rojo", hex: "#FF0000" });

    const duplicate = await request(app)
      .post(`${ADMIN}/color-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "rojo", hex: "#EE0000" });

    expect(duplicate.status).toBe(409);
  });

  it("rejects creating past the MAX_COLOR_TEMPLATES cap", async () => {
    await ColorTemplate.insertMany(
      Array.from({ length: MAX_COLOR_TEMPLATES }, (_, index) => ({
        value: `C${index}`,
        hex: "#000000",
        source: "manual",
        order: index,
      })),
    );

    const response = await request(app)
      .post(`${ADMIN}/color-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "Extra", hex: "#FFFFFF" });

    expect(response.status).toBe(400);
    expect(await ColorTemplate.countDocuments()).toBe(MAX_COLOR_TEMPLATES);
  });

  it("lets an admin set the hex on a previously null (auto-learned) entry", async () => {
    const auto = await ColorTemplate.create({ value: "Verde", hex: null, source: "auto", order: 0 });

    const updated = await request(app)
      .patch(`${ADMIN}/color-templates/${auto.id}`)
      .set("Cookie", adminCookie)
      .send({ hex: "#00FF00" });

    expect(updated.status).toBe(200);
    expect(updated.body.data.colorTemplate.hex).toBe("#00FF00");
  });

  it("creates a two-tone color with a secondaryHex", async () => {
    const created = await request(app)
      .post(`${ADMIN}/color-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "Negro/Rojo", hex: "#0A0A0A", secondaryHex: "#D0021B" });

    expect(created.status).toBe(201);
    expect(created.body.data.colorTemplate.secondaryHex).toBe("#D0021B");
  });

  it("defaults secondaryHex to null when not provided", async () => {
    const created = await request(app)
      .post(`${ADMIN}/color-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "Solo", hex: "#0A0A0A" });

    expect(created.status).toBe(201);
    expect(created.body.data.colorTemplate.secondaryHex).toBeNull();
  });

  it("sets and then clears secondaryHex, covering the admin turning the bicolor toggle off", async () => {
    const created = await request(app)
      .post(`${ADMIN}/color-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "Gris/Blanco", hex: "#808080", secondaryHex: "#FFFFFF" });
    const id = created.body.data.colorTemplate.id as string;

    const cleared = await request(app)
      .patch(`${ADMIN}/color-templates/${id}`)
      .set("Cookie", adminCookie)
      .send({ secondaryHex: null });

    expect(cleared.status).toBe(200);
    expect(cleared.body.data.colorTemplate.secondaryHex).toBeNull();
  });

  it("rejects a malformed secondaryHex value", async () => {
    const response = await request(app)
      .post(`${ADMIN}/color-templates`)
      .set("Cookie", adminCookie)
      .send({ value: "Malo", hex: "#0A0A0A", secondaryHex: "not-a-hex" });

    expect(response.status).toBe(400);
  });
});

describe("learning colors from a product's variants (shared across catalogs)", () => {
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

  it("creates an auto template with hex:null for each distinct color the first time a bike saves its variants", async () => {
    const response = await createBike([
      { sku: "TRM-54-NEG", size: "54", color: "Negro", fulfillmentMode: "in_stock" },
      { sku: "TRM-56-BLA", size: "56", color: "Blanco", fulfillmentMode: "in_stock" },
      // Repeats "Negro" — must not create a duplicate template.
      { sku: "TRM-58-NEG", size: "58", color: "Negro", fulfillmentMode: "in_stock" },
    ]);
    expect(response.status).toBe(201);

    const templates = await ColorTemplate.find({}).sort({ value: 1 }).exec();
    expect(templates.map((t) => t.value)).toEqual(["Blanco", "Negro"]);
    expect(templates.every((t) => t.source === "auto" && t.hex === null && t.secondaryHex === null)).toBe(true);
  });

  it("shares the same template collection between bikes and accessories — a bike-learned color is available without an accessory relearning it", async () => {
    await createBike([{ sku: "TRM-54-VER", size: "54", color: "Verde", fulfillmentMode: "in_stock" }]);
    expect(await ColorTemplate.countDocuments({ value: "Verde" })).toBe(1);

    const response = await createAccessory([{ sku: "CSC-VER", size: "U", color: "Verde", fulfillmentMode: "in_stock" }]);
    expect(response.status).toBe(201);

    // No second "Verde" template was created — the accessory reused the bike-learned one.
    expect(await ColorTemplate.countDocuments({ value: "Verde" })).toBe(1);
  });

  it("never downgrades a manual template to auto, or overwrites its hex, when a product reuses its value", async () => {
    await request(app).post(`${ADMIN}/color-templates`).set("Cookie", adminCookie).send({ value: "Negro", hex: "#0A0A0A" });

    await createBike([{ sku: "TRM-M-NEG", size: "M", color: "Negro", fulfillmentMode: "in_stock" }]);

    const templates = await ColorTemplate.find({ value: "Negro" }).exec();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.source).toBe("manual");
    expect(templates[0]?.hex).toBe("#0A0A0A");
  });

  it("a variant with no color is never learned", async () => {
    const response = await createBike([{ sku: "TRM-NOCOLOR", size: "M", fulfillmentMode: "in_stock" }]);
    expect(response.status).toBe(201);
    expect(await ColorTemplate.countDocuments()).toBe(0);
  });

  it("also learns on update, since variants ride the product's own PATCH", async () => {
    const created = await createBike([{ sku: "TRM-M-NEG", size: "M", color: "Negro", fulfillmentMode: "in_stock" }]);
    const bikeId = created.body.data.bike.id as string;
    expect(await ColorTemplate.countDocuments()).toBe(1);

    const updated = await request(app)
      .patch(`${ADMIN}/bikes/${bikeId}`)
      .set("Cookie", adminCookie)
      .send({
        variants: [
          { sku: "TRM-M-NEG", size: "M", color: "Negro", fulfillmentMode: "in_stock" },
          { sku: "TRM-L-AZU", size: "L", color: "Azul", fulfillmentMode: "in_stock" },
        ],
      });
    expect(updated.status).toBe(200);

    const templates = await ColorTemplate.find({}).sort({ value: 1 }).exec();
    expect(templates.map((t) => t.value)).toEqual(["Azul", "Negro"]);
  });
});
