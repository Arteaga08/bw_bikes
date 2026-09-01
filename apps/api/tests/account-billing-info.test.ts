import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { cookieHeader, parseCookies } from "./helpers/cookies.js";
import { createUser } from "./helpers/factories.js";

const AUTH_BASE = "/api/v1/auth";
const ACCOUNT_BASE = "/api/v1/account";

const VALID_BILLING_INFO = {
  rfc: "XAXX010101000",
  legalName: "Ana Pérez",
  cfdiUse: "G03",
  taxRegime: "605",
  postalCode: "06600",
};

async function loginNewUser(app: ReturnType<typeof buildApp>, email: string): Promise<Record<string, string>> {
  const password = "Correct-Horse-1";
  await createUser({ email, password, emailVerified: true });
  const res = await request(app).post(`${AUTH_BASE}/login`).send({ email, password });
  return parseCookies(res);
}

describe("account billing info", () => {
  it("PUT /account/billing-info requires a session", async () => {
    const app = buildApp();
    const res = await request(app).put(`${ACCOUNT_BASE}/billing-info`).send(VALID_BILLING_INFO);
    expect(res.status).toBe(401);
  });

  it("PUT /account/billing-info saves the fiscal data", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "guardar-fiscal@example.com");

    const res = await request(app)
      .put(`${ACCOUNT_BASE}/billing-info`)
      .set("Cookie", cookieHeader(cookies))
      .send(VALID_BILLING_INFO);

    expect(res.status).toBe(200);
    expect(res.body.data.billingInfo).toMatchObject(VALID_BILLING_INFO);
  });

  it("PUT /account/billing-info replaces existing fiscal data", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "actualizar-fiscal@example.com");

    await request(app).put(`${ACCOUNT_BASE}/billing-info`).set("Cookie", cookieHeader(cookies)).send(VALID_BILLING_INFO);
    const res = await request(app)
      .put(`${ACCOUNT_BASE}/billing-info`)
      .set("Cookie", cookieHeader(cookies))
      .send({ ...VALID_BILLING_INFO, legalName: "Otra Razón Social" });

    expect(res.status).toBe(200);
    expect(res.body.data.billingInfo).toMatchObject({ legalName: "Otra Razón Social" });
  });

  it("DELETE /account/billing-info removes the fiscal data", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "borrar-fiscal@example.com");

    await request(app).put(`${ACCOUNT_BASE}/billing-info`).set("Cookie", cookieHeader(cookies)).send(VALID_BILLING_INFO);
    const deleteRes = await request(app).delete(`${ACCOUNT_BASE}/billing-info`).set("Cookie", cookieHeader(cookies));
    expect(deleteRes.status).toBe(200);

    const accountRes = await request(app).get(ACCOUNT_BASE).set("Cookie", cookieHeader(cookies));
    expect(accountRes.body.data.account.billingInfo).toBeUndefined();
  });

  it("rejects an invalid RFC", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "rfc-invalido@example.com");

    const res = await request(app)
      .put(`${ACCOUNT_BASE}/billing-info`)
      .set("Cookie", cookieHeader(cookies))
      .send({ ...VALID_BILLING_INFO, rfc: "123" });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid CFDI use", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "cfdi-invalido@example.com");

    const res = await request(app)
      .put(`${ACCOUNT_BASE}/billing-info`)
      .set("Cookie", cookieHeader(cookies))
      .send({ ...VALID_BILLING_INFO, cfdiUse: "Z99" });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid tax regime", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "regimen-invalido@example.com");

    const res = await request(app)
      .put(`${ACCOUNT_BASE}/billing-info`)
      .set("Cookie", cookieHeader(cookies))
      .send({ ...VALID_BILLING_INFO, taxRegime: "999" });

    expect(res.status).toBe(400);
  });
});
