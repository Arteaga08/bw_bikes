import { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { ProductView } from "../src/models/index.js";
import { seedBikeWithVariant } from "./helpers/factories.js";

const VIEWS = "/api/v1/catalog/views";

type App = ReturnType<typeof buildApp>;

describe("POST /catalog/views — anonymous product view events", () => {
  it("answers the exact same body for a nonexistent id, an archived product, and a real one", async () => {
    const app: App = buildApp();
    const real = await seedBikeWithVariant({ sku: "BK-VIEW-M" });
    const archived = await seedBikeWithVariant({ sku: "BK-VIEW-ARCHIVED-M", isActive: false });

    const nonexistentRes = await request(app)
      .post(VIEWS)
      .send({ itemType: "bike", itemId: String(new Types.ObjectId()) });

    const archivedRes = await request(app)
      .post(VIEWS)
      .send({ itemType: "bike", itemId: archived.itemId });

    const realRes = await request(app).post(VIEWS).send({ itemType: "bike", itemId: real.itemId });

    expect(nonexistentRes.status).toBe(202);
    expect(archivedRes.status).toBe(202);
    expect(realRes.status).toBe(202);

    // Byte-for-byte identical — a caller cannot distinguish "that id doesn't
    // exist" from "recorded", which is the whole anti-enumeration point.
    expect(nonexistentRes.body).toEqual(realRes.body);
    expect(archivedRes.body).toEqual(realRes.body);
  });

  it("persists only for the real, active product — nothing for the fake or archived ones", async () => {
    const app: App = buildApp();
    const real = await seedBikeWithVariant({ sku: "BK-VIEW2-M" });
    const archived = await seedBikeWithVariant({ sku: "BK-VIEW2-ARCHIVED-M", isActive: false });

    await request(app).post(VIEWS).send({ itemType: "bike", itemId: String(new Types.ObjectId()) });
    await request(app).post(VIEWS).send({ itemType: "bike", itemId: archived.itemId });
    await request(app).post(VIEWS).send({ itemType: "bike", itemId: real.itemId });

    expect(await ProductView.countDocuments({})).toBe(1);
    const stored = await ProductView.findOne({}).exec();
    expect(String(stored?.itemId)).toBe(real.itemId);
  });

  it("silently ignores a SKU that doesn't resolve to a real variant on an otherwise real product", async () => {
    const app: App = buildApp();
    const real = await seedBikeWithVariant({ sku: "BK-VIEW3-M" });

    const res = await request(app)
      .post(VIEWS)
      .send({ itemType: "bike", itemId: real.itemId, sku: "BK-DOES-NOT-EXIST" });

    expect(res.status).toBe(202);
    expect(await ProductView.countDocuments({})).toBe(0);
  });

  it("records a real event with its sku and size", async () => {
    const app: App = buildApp();
    const real = await seedBikeWithVariant({ sku: "BK-VIEW4-M" });

    const res = await request(app)
      .post(VIEWS)
      .send({ itemType: "bike", itemId: real.itemId, sku: real.sku, size: "M" });

    expect(res.status).toBe(202);
    const stored = await ProductView.findOne({}).exec();
    expect(stored).toMatchObject({ itemType: "bike", sku: real.sku, size: "M" });
  });

  it("rejects a malformed body with 400 (this is a validation failure, not an enumeration attempt)", async () => {
    const app: App = buildApp();

    const res = await request(app).post(VIEWS).send({ itemType: "spaceship", itemId: "not-an-id" });

    expect(res.status).toBe(400);
  });
});
