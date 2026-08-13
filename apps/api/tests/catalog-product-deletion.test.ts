import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Accessory, Bike } from "../src/models/index.js";
import { createAdminSession } from "./helpers/admin-session.js";
import { stubCloudinary } from "./helpers/cloudinary.js";
import { createInventoryItemDoc, seedAccessoryWithVariant, seedBikeWithVariant } from "./helpers/factories.js";

const ADMIN = "/api/v1/admin";

describe("product deletion (M10.3) — real delete, archive-first", () => {
  it("rejects deleting a bike that isn't archived yet", async () => {
    const app = buildApp();
    const adminCookie = await createAdminSession(app);
    const { bike } = await seedBikeWithVariant();

    const response = await request(app).delete(`${ADMIN}/bikes/${bike._id}`).set("Cookie", adminCookie);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("archivarse");
    expect(await Bike.findById(bike._id).exec()).not.toBeNull();
  });

  it("deletes an archived bike with no inventory rows", async () => {
    const app = buildApp();
    const adminCookie = await createAdminSession(app);
    const { bike } = await seedBikeWithVariant({ isActive: false });

    const response = await request(app).delete(`${ADMIN}/bikes/${bike._id}`).set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(await Bike.findById(bike._id).exec()).toBeNull();
  });

  it("blocks deleting an archived bike that still has an inventory row — the bike survives", async () => {
    const app = buildApp();
    const adminCookie = await createAdminSession(app);
    const { bike, sku } = await seedBikeWithVariant({ isActive: false });
    await createInventoryItemDoc({ itemType: "bike", itemId: bike._id, sku });

    const response = await request(app).delete(`${ADMIN}/bikes/${bike._id}`).set("Cookie", adminCookie);

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("1 fila");
    expect(await Bike.findById(bike._id).exec()).not.toBeNull();
  });

  it("deletes an archived bike's gallery images from Cloudinary too", async () => {
    const app = buildApp();
    const cloudinary = stubCloudinary();
    const adminCookie = await createAdminSession(app);
    const { bike } = await seedBikeWithVariant({ isActive: false, withGallery: true });

    const response = await request(app).delete(`${ADMIN}/bikes/${bike._id}`).set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(cloudinary.destroySpy).toHaveBeenCalledTimes(2);
  });

  it("mirrors the same archive-first and delete rules for accessories", async () => {
    const app = buildApp();
    const adminCookie = await createAdminSession(app);
    const notArchived = await seedAccessoryWithVariant({ sku: "AC-STOCK-A" });
    const archived = await seedAccessoryWithVariant({ sku: "AC-STOCK-B", isActive: false });

    const blocked = await request(app)
      .delete(`${ADMIN}/accessories/${notArchived.accessory._id}`)
      .set("Cookie", adminCookie);
    expect(blocked.status).toBe(400);

    const removed = await request(app)
      .delete(`${ADMIN}/accessories/${archived.accessory._id}`)
      .set("Cookie", adminCookie);
    expect(removed.status).toBe(200);
    expect(await Accessory.findById(archived.accessory._id).exec()).toBeNull();
  });
});
