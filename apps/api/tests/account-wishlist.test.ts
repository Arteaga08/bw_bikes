import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { cookieHeader, parseCookies } from "./helpers/cookies.js";
import { createUser, seedAccessoryWithVariant, seedBikeWithVariant } from "./helpers/factories.js";

const AUTH_BASE = "/api/v1/auth";
const ACCOUNT_BASE = "/api/v1/account";

async function loginNewUser(app: ReturnType<typeof buildApp>, email: string): Promise<Record<string, string>> {
  const password = "Correct-Horse-1";
  await createUser({ email, password, emailVerified: true });
  const res = await request(app).post(`${AUTH_BASE}/login`).send({ email, password });
  return parseCookies(res);
}

describe("account wishlist", () => {
  it("GET /account/wishlist requires a session", async () => {
    const app = buildApp();
    const res = await request(app).get(`${ACCOUNT_BASE}/wishlist`);
    expect(res.status).toBe(401);
  });

  it("POST /account/wishlist saves a product, hydrated against the live catalog", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "guardar-wishlist@example.com");
    const { itemId } = await seedBikeWithVariant();

    const res = await request(app)
      .post(`${ACCOUNT_BASE}/wishlist`)
      .set("Cookie", cookieHeader(cookies))
      .send({ itemType: "bike", itemId });

    expect(res.status).toBe(201);
    expect(res.body.data.wishlist).toHaveLength(1);
    expect(res.body.data.wishlist[0]).toMatchObject({ itemType: "bike", itemId, isAvailable: true });
    expect(res.body.data.wishlist[0].product).toBeDefined();
  });

  it("saving the same product twice is idempotent, not a duplicate", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "duplicado-wishlist@example.com");
    const { itemId } = await seedBikeWithVariant();

    await request(app).post(`${ACCOUNT_BASE}/wishlist`).set("Cookie", cookieHeader(cookies)).send({ itemType: "bike", itemId });
    const res = await request(app)
      .post(`${ACCOUNT_BASE}/wishlist`)
      .set("Cookie", cookieHeader(cookies))
      .send({ itemType: "bike", itemId });

    expect(res.status).toBe(200);
    expect(res.body.data.wishlist).toHaveLength(1);
  });

  it("DELETE /account/wishlist/:itemType/:itemId removes a saved product", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "quitar-wishlist@example.com");
    const { itemId } = await seedAccessoryWithVariant();

    await request(app)
      .post(`${ACCOUNT_BASE}/wishlist`)
      .set("Cookie", cookieHeader(cookies))
      .send({ itemType: "accessory", itemId });
    const res = await request(app)
      .delete(`${ACCOUNT_BASE}/wishlist/accessory/${itemId}`)
      .set("Cookie", cookieHeader(cookies));

    expect(res.status).toBe(200);
    expect(res.body.data.wishlist).toHaveLength(0);
  });

  it("rejects a 51st saved product with 409", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "tope-wishlist@example.com");

    for (let index = 0; index < 50; index += 1) {
      const { itemId } = await seedBikeWithVariant({ sku: `BK-WISH-${index}` });
      const res = await request(app)
        .post(`${ACCOUNT_BASE}/wishlist`)
        .set("Cookie", cookieHeader(cookies))
        .send({ itemType: "bike", itemId });
      expect(res.status).toBe(201);
    }

    const { itemId: overflowId } = await seedBikeWithVariant({ sku: "BK-WISH-OVERFLOW" });
    const res = await request(app)
      .post(`${ACCOUNT_BASE}/wishlist`)
      .set("Cookie", cookieHeader(cookies))
      .send({ itemType: "bike", itemId: overflowId });

    expect(res.status).toBe(409);
  });

  it("an archived product stays in the list, marked isAvailable: false, instead of disappearing", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "archivado-wishlist@example.com");
    const { itemId } = await seedBikeWithVariant({ isActive: false });

    const res = await request(app)
      .post(`${ACCOUNT_BASE}/wishlist`)
      .set("Cookie", cookieHeader(cookies))
      .send({ itemType: "bike", itemId });

    expect(res.status).toBe(201);
    expect(res.body.data.wishlist[0]).toMatchObject({ itemId, isAvailable: false });
    expect(res.body.data.wishlist[0].product).toBeDefined();
  });

  it("GET /account includes the wishlist count, not the hydrated list", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "conteo-wishlist@example.com");
    const { itemId } = await seedBikeWithVariant();

    await request(app).post(`${ACCOUNT_BASE}/wishlist`).set("Cookie", cookieHeader(cookies)).send({ itemType: "bike", itemId });
    const res = await request(app).get(ACCOUNT_BASE).set("Cookie", cookieHeader(cookies));

    expect(res.body.data.account.wishlistCount).toBe(1);
    expect(res.body.data.account.wishlist).toBeUndefined();
  });
});
