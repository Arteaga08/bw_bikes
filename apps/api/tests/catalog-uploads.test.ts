import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Bike } from "../src/models/index.js";
import { MAX_FILE_SIZE_BYTES } from "../src/middlewares/upload-images.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { stubCloudinary } from "./helpers/cloudinary.js";
import { createBikeCategoryDoc } from "./helpers/factories.js";
import { makeJpegBuffer, makePngBuffer, makeTextBuffer, makeWebpBuffer } from "./helpers/images.js";

const ADMIN = "/api/v1/admin";

describe("gallery uploads are validated by magic bytes", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let bikeId: string;
  let cloudinary: ReturnType<typeof stubCloudinary>;

  beforeEach(async () => {
    app = buildApp();
    cloudinary = stubCloudinary();
    adminCookie = await createAdminSession(app);
    const category = await createBikeCategoryDoc({ slug: "ruta" });

    const created = await request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send({
      name: "Tarmac SL8",
      brand: "Specialized",
      category: String(category._id),
      shortDescription: "Bici de ruta",
      description: "Descripción",
      price: 19_999_900,
      brakeType: "hydraulic_disc",
    });
    bikeId = created.body.data.bike._id as string;
  });

  /**
   * The milestone's closing criterion. Both signals the client controls are
   * forged — the filename says `.jpg` and the declared Content-Type says
   * `image/jpeg` — while the actual bytes are a PNG. Only an inspection of the
   * bytes themselves catches this.
   */
  it("rejects a .png renamed to .jpg, without ever calling Cloudinary", async () => {
    const png = await makePngBuffer();

    const response = await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .attach("images", png, { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("PNG");

    // The decisive part: the file never left for Cloudinary and nothing was
    // written to the product.
    expect(cloudinary.uploadSpy).not.toHaveBeenCalled();
    const stored = await Bike.findById(bikeId).exec();
    expect(stored?.gallery).toHaveLength(0);
  });

  it("accepts the same PNG once its name matches its bytes", async () => {
    const png = await makePngBuffer();

    const response = await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .attach("images", png, { filename: "foto.png", contentType: "image/png" });

    // Proves the previous case failed on the *contradiction*, not on the file
    // being a PNG — PNG is an accepted format.
    expect(response.status).toBe(201);
    expect(cloudinary.uploadSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-image renamed to .jpg, without ever calling Cloudinary", async () => {
    const text = makeTextBuffer();

    const response = await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .attach("images", text, { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("no es una imagen válida");

    // The decisive assertion: validation short-circuits before the network.
    expect(cloudinary.uploadSpy).not.toHaveBeenCalled();
    const stored = await Bike.findById(bikeId).exec();
    expect(stored?.gallery).toHaveLength(0);
  });

  it("rejects a batch whole when one of its files is forged", async () => {
    const jpeg = await makeJpegBuffer();
    const text = makeTextBuffer();

    const response = await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .attach("images", jpeg, { filename: "buena.jpg", contentType: "image/jpeg" })
      .attach("images", text, { filename: "mala.png", contentType: "image/png" });

    expect(response.status).toBe(400);
    // Nothing was uploaded: validation of the whole batch precedes any upload,
    // so the request can't half-succeed.
    expect(cloudinary.uploadSpy).not.toHaveBeenCalled();
    const stored = await Bike.findById(bikeId).exec();
    expect(stored?.gallery).toHaveLength(0);
  });

  it("accepts a real JPEG and a real WebP", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .attach("images", await makeJpegBuffer(), { filename: "a.jpg", contentType: "image/jpeg" })
      .attach("images", await makeWebpBuffer(), { filename: "b.webp", contentType: "image/webp" });

    expect(response.status).toBe(201);
    expect(cloudinary.uploadSpy).toHaveBeenCalledTimes(2);

    const stored = await Bike.findById(bikeId).exec();
    expect(stored?.gallery).toHaveLength(2);
    // A publicId is what's persisted — never a baked, fixed-size URL.
    expect(stored?.gallery[0]?.publicId).toContain("bw-bikes/bikes/");
    expect(stored?.gallery.map((image) => image.order)).toEqual([0, 1]);
  });

  it("rejects a file over the size limit before reading it all", async () => {
    // Valid JPEG header so the rejection can only come from the size guard.
    const oversized = Buffer.concat([await makeJpegBuffer(), Buffer.alloc(MAX_FILE_SIZE_BYTES)]);

    const response = await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .attach("images", oversized, { filename: "enorme.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("MB");
    expect(cloudinary.uploadSpy).not.toHaveBeenCalled();
  });

  it("rejects a request with no file at all", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .field("alt", "Foto de la bici");

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("al menos una imagen");
  });

  it("escapes an XSS payload in the multipart alt text", async () => {
    await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .field("alt", '<img src=x onerror=alert(1)>Tarmac')
      .attach("images", await makeJpegBuffer(), { filename: "a.jpg", contentType: "image/jpeg" });

    // The global sanitizeInput middleware can't see multipart fields (it runs
    // behind express.json), so this proves the route's explicit sanitization
    // covered the gap.
    const stored = await Bike.findById(bikeId).exec();
    const alt = stored?.gallery[0]?.alt ?? "";
    expect(alt).not.toContain("onerror");
  });
});

describe("gallery management", () => {
  let app: ReturnType<typeof buildApp>;
  let adminCookie: string;
  let bikeId: string;
  let cloudinary: ReturnType<typeof stubCloudinary>;

  beforeEach(async () => {
    app = buildApp();
    cloudinary = stubCloudinary();
    adminCookie = await createAdminSession(app);
    const category = await createBikeCategoryDoc({ slug: "ruta" });

    const created = await request(app).post(`${ADMIN}/bikes`).set("Cookie", adminCookie).send({
      name: "Tarmac SL8",
      brand: "Specialized",
      category: String(category._id),
      shortDescription: "Bici de ruta",
      description: "Descripción",
      price: 19_999_900,
      brakeType: "hydraulic_disc",
    });
    bikeId = created.body.data.bike._id as string;

    await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .attach("images", await makeJpegBuffer(), { filename: "a.jpg", contentType: "image/jpeg" })
      .attach("images", await makeJpegBuffer(), { filename: "b.jpg", contentType: "image/jpeg" });
  });

  it("removes an image and re-indexes the remaining order", async () => {
    const before = await Bike.findById(bikeId).exec();
    const [first, second] = before!.gallery;

    const response = await request(app)
      .delete(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .send({ publicId: first!.publicId });

    expect(response.status).toBe(200);
    expect(cloudinary.destroySpy).toHaveBeenCalledWith(first!.publicId, { resource_type: "image" });

    const after = await Bike.findById(bikeId).exec();
    expect(after?.gallery).toHaveLength(1);
    expect(after?.gallery[0]?.publicId).toBe(second!.publicId);
    expect(after?.gallery[0]?.order).toBe(0);
  });

  it("rejects deleting an image that belongs to another product", async () => {
    const response = await request(app)
      .delete(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .send({ publicId: "bw-bikes/bikes/de-otro-producto" });

    expect(response.status).toBe(404);
    expect(cloudinary.destroySpy).not.toHaveBeenCalled();
  });

  it("reorders the gallery", async () => {
    const before = await Bike.findById(bikeId).exec();
    const reversed = [...before!.gallery].reverse().map((image) => image.publicId);

    const response = await request(app)
      .patch(`${ADMIN}/bikes/${bikeId}/gallery/order`)
      .set("Cookie", adminCookie)
      .send({ publicIds: reversed });

    expect(response.status).toBe(200);
    const after = await Bike.findById(bikeId).exec();
    expect(after?.gallery.map((image) => image.publicId)).toEqual(reversed);
    expect(after?.gallery.map((image) => image.order)).toEqual([0, 1]);
  });

  it("rejects a reorder that doesn't list every image", async () => {
    const before = await Bike.findById(bikeId).exec();

    const response = await request(app)
      .patch(`${ADMIN}/bikes/${bikeId}/gallery/order`)
      .set("Cookie", adminCookie)
      .send({ publicIds: [before!.gallery[0]!.publicId] });

    expect(response.status).toBe(400);
  });
});
