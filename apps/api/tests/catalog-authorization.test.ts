import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { BikeCategory } from "../src/models/index.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";

const ADMIN = "/api/v1/admin";
const PUBLIC = "/api/v1/catalog";

/**
 * Every write in the catalog sits behind `protect` + `restrictTo` mounted on
 * the whole `/admin` router, so this asserts the guard at the router level
 * rather than route by route.
 */
describe("catalog write routes are admin-only", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  it("rejects an anonymous request with 401", async () => {
    const response = await request(app).post(`${ADMIN}/bike-categories`).send({ name: "Montaña" });

    expect(response.status).toBe(401);
    expect(await BikeCategory.countDocuments()).toBe(0);
  });

  it("rejects a logged-in customer with 403", async () => {
    const customerCookie = await createCustomerSession(app);

    const response = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", customerCookie)
      .send({ name: "Montaña" });

    expect(response.status).toBe(403);
    expect(await BikeCategory.countDocuments()).toBe(0);
  });

  it("rejects a customer from reading the admin list too", async () => {
    const customerCookie = await createCustomerSession(app);

    const response = await request(app).get(`${ADMIN}/bikes`).set("Cookie", customerCookie);

    expect(response.status).toBe(403);
  });

  it("allows an admin with 2FA enrolled", async () => {
    const adminCookie = await createAdminSession(app);

    const response = await request(app)
      .post(`${ADMIN}/bike-categories`)
      .set("Cookie", adminCookie)
      .send({ name: "Montaña" });

    expect(response.status).toBe(201);
  });

  it("leaves the public catalog reachable without any session", async () => {
    const response = await request(app).get(`${PUBLIC}/bikes`);

    expect(response.status).toBe(200);
    expect(response.body.meta).toBeDefined();
  });
});

describe("malformed identifiers", () => {
  it("returns a clean 400 instead of leaking a Mongoose CastError", async () => {
    const app = buildApp();
    const adminCookie = await createAdminSession(app);

    const response = await request(app).get(`${ADMIN}/bikes/not-an-object-id`).set("Cookie", adminCookie);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Identificador inválido");
  });
});
