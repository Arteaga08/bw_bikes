import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Bike } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { stubCloudinary } from "./helpers/cloudinary.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";
import { makeJpegBuffer, makePngBuffer } from "./helpers/images.js";

const ADMIN = "/api/v1/admin";

/**
 * The geometry chart (M10.6) — a single image, so unlike the gallery it has no
 * reorder and no delete-by-publicId: POST replaces, DELETE clears. What's
 * worth asserting beyond the happy path is that replacing actually *destroys*
 * the previous Cloudinary asset (otherwise every re-upload orphans one) and
 * that the chart never leaks into the commercial gallery.
 */
describe("bike geometry image", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let bikeId: string;
  let bikeSlug: string;
  let cloudinary: ReturnType<typeof stubCloudinary>;

  beforeEach(async () => {
    app = buildApp();
    cloudinary = stubCloudinary();
    adminCookie = await createAdminSession(app);
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
    bikeId = created.body.data.bike.id as string;
    bikeSlug = created.body.data.bike.slug as string;
  });

  function upload(buffer: Buffer, filename = "geometria.jpg", contentType = "image/jpeg") {
    return request(app)
      .post(`${ADMIN}/bikes/${bikeId}/geometry-image`)
      .set("Cookie", adminCookie)
      .attach("images", buffer, { filename, contentType });
  }

  it("uploads a chart and keeps it out of the gallery", async () => {
    const response = await upload(await makeJpegBuffer());

    expect(response.status).toBe(200);
    expect(response.body.data.geometryImage.publicId).toContain("bike-geometry");

    const stored = await Bike.findById(bikeId).exec();
    expect(stored?.geometryImage?.publicId).toBeTruthy();
    // The decisive part: the chart is a diagram, not a carousel shot.
    expect(stored?.gallery).toHaveLength(0);
  });

  it("replaces the chart and destroys the previous asset", async () => {
    await upload(await makeJpegBuffer());
    const first = await Bike.findById(bikeId).exec();
    const firstPublicId = first!.geometryImage!.publicId;

    const response = await upload(await makePngBuffer(), "geometria.png", "image/png");
    expect(response.status).toBe(200);

    const second = await Bike.findById(bikeId).exec();
    expect(second!.geometryImage!.publicId).not.toBe(firstPublicId);
    // Without this the bike keeps one orphaned asset per re-upload.
    expect(cloudinary.destroySpy).toHaveBeenCalledWith(firstPublicId, expect.anything());
  });

  it("clears the chart and destroys its asset", async () => {
    await upload(await makeJpegBuffer());
    const stored = await Bike.findById(bikeId).exec();
    const { publicId } = stored!.geometryImage!;

    const response = await request(app)
      .delete(`${ADMIN}/bikes/${bikeId}/geometry-image`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(cloudinary.destroySpy).toHaveBeenCalledWith(publicId, expect.anything());
    const after = await Bike.findById(bikeId).exec();
    expect(after?.geometryImage ?? null).toBeNull();
  });

  it("rejects clearing a chart that was never set", async () => {
    const response = await request(app)
      .delete(`${ADMIN}/bikes/${bikeId}/geometry-image`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(409);
    expect(cloudinary.destroySpy).not.toHaveBeenCalled();
  });

  it("rejects more than one file", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/geometry-image`)
      .set("Cookie", adminCookie)
      .attach("images", await makeJpegBuffer(), { filename: "a.jpg", contentType: "image/jpeg" })
      .attach("images", await makeJpegBuffer(), { filename: "b.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(400);
    const stored = await Bike.findById(bikeId).exec();
    expect(stored?.geometryImage ?? null).toBeNull();
  });

  it("serves the chart on the public PDP payload", async () => {
    await upload(await makeJpegBuffer());

    const response = await request(app).get(`/api/v1/catalog/bikes/${bikeSlug}`);

    expect(response.status).toBe(200);
    expect(response.body.data.bike.geometryImage.url).toContain("res.cloudinary.com");
  });

  it("omits the chart entirely when there is none", async () => {
    const response = await request(app).get(`/api/v1/catalog/bikes/${bikeSlug}`);

    // Absent, not `null` — the storefront checks for the key's presence.
    expect(response.body.data.bike).not.toHaveProperty("geometryImage");
  });
});
