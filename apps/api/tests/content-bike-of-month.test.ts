import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { stubCloudinary } from "./helpers/cloudinary.js";
import { seedBikeWithVariant } from "./helpers/factories.js";
import { makeJpegBuffer } from "./helpers/images.js";

const ADMIN = "/api/v1/admin/content/bike-of-month";
const PUBLIC = "/api/v1/content/bike-of-month";

describe("admin bike of the month", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    stubCloudinary();
    adminCookie = await createAdminSession(app);
  });

  it("rejects every route without a session", async () => {
    const responses = await Promise.all([
      request(app).get(ADMIN),
      request(app).put(ADMIN).send({ title: "Bici" }),
      request(app).delete(`${ADMIN}/image`),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });

  it("starts as a single empty singleton, with no create step", async () => {
    const response = await request(app).get(ADMIN).set("Cookie", adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.data.bikeOfMonth.title).toBeUndefined();
    expect(response.body.data.bikeOfMonth.image).toBeUndefined();
    expect(response.body.data.bikeOfMonth.href).toBeNull();
  });

  it("refuses a bikeId that doesn't exist in the catalog", async () => {
    const response = await request(app)
      .put(ADMIN)
      .set("Cookie", adminCookie)
      .send({ title: "Bici del mes", bikeId: "64f000000000000000000000" });
    expect(response.status).toBe(400);
  });

  it("saves text, resolves the chosen bike's href, and uploads/removes the image", async () => {
    const { bike } = await seedBikeWithVariant();

    const saved = await request(app)
      .put(ADMIN)
      .set("Cookie", adminCookie)
      .send({ title: "Bici del mes", eyebrow: "Nueva temporada", bikeId: String(bike._id) });
    expect(saved.status).toBe(200);
    expect(saved.body.data.bikeOfMonth.href).toBe(`/bicicletas/${bike.slug}`);
    expect(saved.body.data.bikeOfMonth.isBroken).toBe(false);

    const jpeg = await makeJpegBuffer();
    const uploaded = await request(app)
      .post(`${ADMIN}/image`)
      .set("Cookie", adminCookie)
      .attach("images", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.data.bikeOfMonth.image.publicId).toBeDefined();

    const removed = await request(app).delete(`${ADMIN}/image`).set("Cookie", adminCookie);
    expect(removed.status).toBe(200);
    expect(removed.body.data.bikeOfMonth.image).toBeUndefined();
  });

  it("flags the banner as broken once the referenced bike is archived", async () => {
    const { bike } = await seedBikeWithVariant();
    await request(app).put(ADMIN).set("Cookie", adminCookie).send({ title: "Bici del mes", bikeId: String(bike._id) });

    bike.isActive = false;
    bike.archivedAt = new Date();
    await bike.save();

    const response = await request(app).get(ADMIN).set("Cookie", adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.data.bikeOfMonth.href).toBeNull();
    expect(response.body.data.bikeOfMonth.isBroken).toBe(true);
  });

  it("refuses removing an image when there is none", async () => {
    const response = await request(app).delete(`${ADMIN}/image`).set("Cookie", adminCookie);
    expect(response.status).toBe(409);
  });
});

describe("public bike of the month", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    stubCloudinary();
    adminCookie = await createAdminSession(app);
  });

  it("is reachable without a session and returns null while incomplete", async () => {
    const response = await request(app).get(PUBLIC);
    expect(response.status).toBe(200);
    expect(response.body.data.bikeOfMonth).toBeNull();
  });

  it("publishes only once image, title and a working bike reference are all set", async () => {
    const { bike } = await seedBikeWithVariant();

    await request(app).put(ADMIN).set("Cookie", adminCookie).send({ title: "Bici del mes", bikeId: String(bike._id) });
    const stillMissingImage = await request(app).get(PUBLIC);
    expect(stillMissingImage.body.data.bikeOfMonth).toBeNull();

    const jpeg = await makeJpegBuffer();
    await request(app)
      .post(`${ADMIN}/image`)
      .set("Cookie", adminCookie)
      .attach("images", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });

    const response = await request(app).get(PUBLIC);
    expect(response.status).toBe(200);
    expect(response.body.data.bikeOfMonth.title).toBe("Bici del mes");
    expect(response.body.data.bikeOfMonth.href).toBe(`/bicicletas/${bike.slug}`);
    expect(response.body.data.bikeOfMonth.image.publicId).toBeDefined();
  });

  it("drops the banner from the public payload once its bike is archived", async () => {
    const { bike } = await seedBikeWithVariant();
    await request(app).put(ADMIN).set("Cookie", adminCookie).send({ title: "Bici del mes", bikeId: String(bike._id) });
    const jpeg = await makeJpegBuffer();
    await request(app)
      .post(`${ADMIN}/image`)
      .set("Cookie", adminCookie)
      .attach("images", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });

    bike.isActive = false;
    bike.archivedAt = new Date();
    await bike.save();

    const response = await request(app).get(PUBLIC);
    expect(response.status).toBe(200);
    expect(response.body.data.bikeOfMonth).toBeNull();
  });
});
