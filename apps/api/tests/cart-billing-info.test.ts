import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createCustomerSession } from "./helpers/admin-session.js";

const CART = "/api/v1/cart";

const VALID_BILLING_INFO = {
  rfc: "XAXX010101000",
  legalName: "Ana Pérez",
  cfdiUse: "G03",
  taxRegime: "605",
  postalCode: "06600",
};

describe("cart billing info removal", () => {
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    app = buildApp();
    cookie = await createCustomerSession(app, "cart-billing-customer@example.com");
  });

  it("requires a session", async () => {
    const res = await request(app).delete(`${CART}/billing-info`);
    expect(res.status).toBe(401);
  });

  it("clears previously saved fiscal data", async () => {
    await request(app).put(`${CART}/billing-info`).set("Cookie", cookie).send(VALID_BILLING_INFO);

    const deleteRes = await request(app).delete(`${CART}/billing-info`).set("Cookie", cookie);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.cart.billingInfo).toBeUndefined();

    const cartRes = await request(app).get(CART).set("Cookie", cookie);
    expect(cartRes.body.data.cart.billingInfo).toBeUndefined();
  });

  it("is a no-op, not an error, on a cart that never had billing info", async () => {
    const res = await request(app).delete(`${CART}/billing-info`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.cart.billingInfo).toBeUndefined();
  });
});
