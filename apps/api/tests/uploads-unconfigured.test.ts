import request from "supertest";
import { describe, expect, it, vi } from "vitest";

/**
 * The case a developer hits before a Cloudinary account exists — and the case
 * this project will be in for most of the backend phase, since the real
 * credentials get wired up at the end of it.
 *
 * `env` is a frozen object, so the flag can't be spied on in place; the module
 * is replaced instead, keeping every other value identical. This lives in its
 * own file because a module mock applies to the whole file.
 */
vi.mock("../src/config/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/config/env.js")>();
  return { ...actual, env: { ...actual.env, isCloudinaryConfigured: false } };
});

const { buildApp } = await import("../src/app.js");
const { Bike } = await import("../src/models/index.js");
const { createAdminSession } = await import("./helpers/admin-session.js");
const { stubCloudinary } = await import("./helpers/cloudinary.js");
const { createBikeCategoryDoc, createBrandDoc } = await import("./helpers/factories.js");
const { makeJpegBuffer } = await import("./helpers/images.js");

const ADMIN = "/api/v1/admin";

describe("Cloudinary not configured", () => {
  it("still serves the rest of the API", async () => {
    const app = buildApp();

    const health = await request(app).get("/api/v1/health");
    const catalog = await request(app).get("/api/v1/catalog/bikes");

    // The whole point of not making these vars fatal outside production:
    // missing media credentials must not take the API down.
    expect(health.status).toBe(200);
    expect(catalog.status).toBe(200);
  });

  it("refuses an upload with an explicit 503 instead of faking success", async () => {
    const app = buildApp();
    const cloudinary = stubCloudinary();
    const adminCookie = await createAdminSession(app);
    const category = await createBikeCategoryDoc({ slug: "ruta" });
    const brand = await createBrandDoc();

    const created = await request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send({
      name: "Tarmac SL8",
      brand: String(brand._id),
      category: String(category._id),
      shortDescription: "Bici de ruta",
      description: "Descripción",
      price: 19_999_900,
    });
    const bikeId = created.body.data.bike.id as string;

    const response = await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .attach("images", await makeJpegBuffer(), { filename: "a.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(503);
    expect(response.body.message).toContain("Cloudinary");

    // Nothing was sent anywhere and nothing was written — a "not configured"
    // state never produces a product pointing at an image that doesn't exist.
    expect(cloudinary.uploadSpy).not.toHaveBeenCalled();
    const stored = await Bike.findById(bikeId).exec();
    expect(stored?.gallery).toHaveLength(0);
  });
});
