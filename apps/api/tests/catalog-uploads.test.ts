import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Bike } from "../src/models/index.js";
import { MAX_FILE_SIZE_BYTES } from "../src/middlewares/upload-images.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { stubCloudinary } from "./helpers/cloudinary.js";
import { createBikeCategoryDoc, createBrandDoc } from "./helpers/factories.js";
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

  it("tags an image with a color, reflected on the next GET", async () => {
    const before = await Bike.findById(bikeId).exec();
    const publicId = before!.gallery[0]!.publicId;

    const response = await request(app)
      .patch(`${ADMIN}/bikes/${bikeId}/gallery/color`)
      .set("Cookie", adminCookie)
      .send({ publicId, color: "Negro" });

    expect(response.status).toBe(200);
    expect(response.body.data.gallery.find((image: { publicId: string }) => image.publicId === publicId).color).toBe(
      "Negro",
    );

    const stored = await request(app).get(`${ADMIN}/bikes/${bikeId}`).set("Cookie", adminCookie);
    expect(stored.body.data.bike.gallery.find((image: { publicId: string }) => image.publicId === publicId).color).toBe(
      "Negro",
    );
  });

  it("clears a previously set color when color is sent empty", async () => {
    const before = await Bike.findById(bikeId).exec();
    const publicId = before!.gallery[0]!.publicId;

    await request(app).patch(`${ADMIN}/bikes/${bikeId}/gallery/color`).set("Cookie", adminCookie).send({ publicId, color: "Negro" });

    const response = await request(app)
      .patch(`${ADMIN}/bikes/${bikeId}/gallery/color`)
      .set("Cookie", adminCookie)
      .send({ publicId, color: "" });

    expect(response.status).toBe(200);
    const tagged = response.body.data.gallery.find((image: { publicId: string }) => image.publicId === publicId);
    expect(tagged.color).toBeUndefined();
  });

  it("rejects tagging a color on an image that belongs to another product", async () => {
    const response = await request(app)
      .patch(`${ADMIN}/bikes/${bikeId}/gallery/color`)
      .set("Cookie", adminCookie)
      .send({ publicId: "bw-bikes/bikes/de-otro-producto", color: "Negro" });

    expect(response.status).toBe(404);
  });

  it("accepts a color tag on the upload itself", async () => {
    const response = await request(app)
      .post(`${ADMIN}/bikes/${bikeId}/gallery`)
      .set("Cookie", adminCookie)
      .field("color", "Azul")
      .attach("images", await makeJpegBuffer(), { filename: "c.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(201);
    const uploaded = response.body.data.gallery[response.body.data.gallery.length - 1];
    expect(uploaded.color).toBe("Azul");
  });

  describe("cap of 2 photos per color", () => {
    it("rejects retagging a 3rd image with a color that already has 2", async () => {
      const before = await Bike.findById(bikeId).exec();
      const [first, second] = before!.gallery;

      await request(app).patch(`${ADMIN}/bikes/${bikeId}/gallery/color`).set("Cookie", adminCookie).send({ publicId: first!.publicId, color: "Negro" });
      await request(app).patch(`${ADMIN}/bikes/${bikeId}/gallery/color`).set("Cookie", adminCookie).send({ publicId: second!.publicId, color: "Negro" });

      const uploadThird = await request(app)
        .post(`${ADMIN}/bikes/${bikeId}/gallery`)
        .set("Cookie", adminCookie)
        .attach("images", await makeJpegBuffer(), { filename: "c.jpg", contentType: "image/jpeg" });
      const thirdPublicId = uploadThird.body.data.gallery[uploadThird.body.data.gallery.length - 1].publicId as string;

      const response = await request(app)
        .patch(`${ADMIN}/bikes/${bikeId}/gallery/color`)
        .set("Cookie", adminCookie)
        .send({ publicId: thirdPublicId, color: "Negro" });

      expect(response.status).toBe(400);
      const after = await Bike.findById(bikeId).exec();
      expect(after?.gallery.find((image) => image.publicId === thirdPublicId)?.color).toBeUndefined();
    });

    it("allows retagging when the target color already has exactly 1 image", async () => {
      const before = await Bike.findById(bikeId).exec();
      const [first] = before!.gallery;

      await request(app).patch(`${ADMIN}/bikes/${bikeId}/gallery/color`).set("Cookie", adminCookie).send({ publicId: first!.publicId, color: "Negro" });

      const uploadThird = await request(app)
        .post(`${ADMIN}/bikes/${bikeId}/gallery`)
        .set("Cookie", adminCookie)
        .attach("images", await makeJpegBuffer(), { filename: "c.jpg", contentType: "image/jpeg" });
      const thirdPublicId = uploadThird.body.data.gallery[uploadThird.body.data.gallery.length - 1].publicId as string;

      const response = await request(app)
        .patch(`${ADMIN}/bikes/${bikeId}/gallery/color`)
        .set("Cookie", adminCookie)
        .send({ publicId: thirdPublicId, color: "Negro" });

      expect(response.status).toBe(200);
    });

    it("rejects an upload batch whose color would push the count over 2, leaving the gallery unchanged", async () => {
      const before = await Bike.findById(bikeId).exec();
      const [first, second] = before!.gallery;

      await request(app).patch(`${ADMIN}/bikes/${bikeId}/gallery/color`).set("Cookie", adminCookie).send({ publicId: first!.publicId, color: "Negro" });
      await request(app).patch(`${ADMIN}/bikes/${bikeId}/gallery/color`).set("Cookie", adminCookie).send({ publicId: second!.publicId, color: "Negro" });

      const response = await request(app)
        .post(`${ADMIN}/bikes/${bikeId}/gallery`)
        .set("Cookie", adminCookie)
        .field("color", "Negro")
        .attach("images", await makeJpegBuffer(), { filename: "c.jpg", contentType: "image/jpeg" });

      expect(response.status).toBe(400);
      const after = await Bike.findById(bikeId).exec();
      expect(after?.gallery).toHaveLength(2);
    });
  });
});
