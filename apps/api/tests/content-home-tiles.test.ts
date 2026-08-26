import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { stubCloudinary } from "./helpers/cloudinary.js";
import { makeJpegBuffer, makePngBuffer } from "./helpers/images.js";

const ADMIN = "/api/v1/admin/content/home-tiles";
const PUBLIC = "/api/v1/content/home-tiles";

describe("admin home CTA tiles", () => {
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
      request(app).delete(`${ADMIN}/bikes/image`),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });

  it("lists exactly the two fixed slots, both without an image, with no create step", async () => {
    const response = await request(app).get(ADMIN).set("Cookie", adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.data.tiles).toHaveLength(2);
    const slots = response.body.data.tiles.map((tile: { slot: string }) => tile.slot).sort();
    expect(slots).toEqual(["accessories", "bikes"]);
    for (const tile of response.body.data.tiles) {
      expect(tile.image).toBeUndefined();
    }
  });

  it("refuses a slot outside the fixed two", async () => {
    const jpeg = await makeJpegBuffer();
    const response = await request(app)
      .post(`${ADMIN}/electricas/image`)
      .set("Cookie", adminCookie)
      .attach("images", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });
    expect(response.status).toBe(400);
  });

  it("uploads, replaces and removes a slot's image, rejecting a mislabeled PNG", async () => {
    const png = await makePngBuffer();
    const rejected = await request(app)
      .post(`${ADMIN}/bikes/image`)
      .set("Cookie", adminCookie)
      .attach("images", png, { filename: "foto.jpg", contentType: "image/jpeg" });
    expect(rejected.status).toBe(400);

    const jpeg = await makeJpegBuffer();
    const uploaded = await request(app)
      .post(`${ADMIN}/bikes/image`)
      .set("Cookie", adminCookie)
      .attach("images", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });
    expect(uploaded.status).toBe(200);
    const firstPublicId = uploaded.body.data.tile.image.publicId as string;
    expect(firstPublicId).toBeDefined();

    const replaced = await request(app)
      .post(`${ADMIN}/bikes/image`)
      .set("Cookie", adminCookie)
      .attach("images", jpeg, { filename: "otra.jpg", contentType: "image/jpeg" });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.tile.image.publicId).toBeDefined();

    const removed = await request(app).delete(`${ADMIN}/bikes/image`).set("Cookie", adminCookie);
    expect(removed.status).toBe(200);
    expect(removed.body.data.tile.image).toBeUndefined();
  });

  it("refuses removing an image from a slot that has none", async () => {
    const response = await request(app).delete(`${ADMIN}/accessories/image`).set("Cookie", adminCookie);
    expect(response.status).toBe(409);
  });
});

describe("public home CTA tiles", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;

  beforeEach(async () => {
    app = buildApp();
    stubCloudinary();
    adminCookie = await createAdminSession(app);
  });

  it("is reachable without a session and returns nothing while no slot has an image", async () => {
    const response = await request(app).get(PUBLIC);
    expect(response.status).toBe(200);
    expect(response.body.data.tiles).toEqual([]);
  });

  it("returns only the slots that have an image", async () => {
    const jpeg = await makeJpegBuffer();
    await request(app)
      .post(`${ADMIN}/bikes/image`)
      .set("Cookie", adminCookie)
      .attach("images", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });

    const response = await request(app).get(PUBLIC);
    expect(response.status).toBe(200);
    expect(response.body.data.tiles).toHaveLength(1);
    expect(response.body.data.tiles[0].slot).toBe("bikes");
    expect(response.body.data.tiles[0].image.publicId).toBeDefined();
  });
});
