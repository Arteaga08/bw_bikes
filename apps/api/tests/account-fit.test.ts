import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { cookieHeader, parseCookies } from "./helpers/cookies.js";
import { createUser } from "./helpers/factories.js";

const AUTH_BASE = "/api/v1/auth";
const ACCOUNT_BASE = "/api/v1/account";

async function loginNewUser(app: ReturnType<typeof buildApp>, email: string): Promise<Record<string, string>> {
  const password = "Correct-Horse-1";
  await createUser({ email, password, emailVerified: true });
  const res = await request(app).post(`${AUTH_BASE}/login`).send({ email, password });
  return parseCookies(res);
}

describe("account fit", () => {
  it("PUT /account/fit requires a session", async () => {
    const app = buildApp();
    const res = await request(app).put(`${ACCOUNT_BASE}/fit`).send({ heightCm: 175, rideStyle: "balanced" });
    expect(res.status).toBe(401);
  });

  it("PUT /account/fit saves height and ride style", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "guardar-fit@example.com");

    const res = await request(app)
      .put(`${ACCOUNT_BASE}/fit`)
      .set("Cookie", cookieHeader(cookies))
      .send({ heightCm: 175, rideStyle: "balanced" });

    expect(res.status).toBe(200);
    expect(res.body.data.fit).toMatchObject({ heightCm: 175, rideStyle: "balanced", gearSizes: [] });
  });

  it("PUT /account/fit updates height and ride style", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "actualizar-fit@example.com");

    await request(app).put(`${ACCOUNT_BASE}/fit`).set("Cookie", cookieHeader(cookies)).send({ heightCm: 175, rideStyle: "balanced" });
    const res = await request(app)
      .put(`${ACCOUNT_BASE}/fit`)
      .set("Cookie", cookieHeader(cookies))
      .send({ heightCm: 182, rideStyle: "performance" });

    expect(res.status).toBe(200);
    expect(res.body.data.fit).toMatchObject({ heightCm: 182, rideStyle: "performance" });
  });

  it("PUT /account/fit saves equipment sizes", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "tallas-equipo@example.com");

    const res = await request(app)
      .put(`${ACCOUNT_BASE}/fit`)
      .set("Cookie", cookieHeader(cookies))
      .send({ gearSizes: [{ category: "helmet", value: "M" }] });

    expect(res.status).toBe(200);
    expect(res.body.data.fit.gearSizes).toEqual([{ category: "helmet", value: "M" }]);
  });

  it("GET /account includes the saved fit", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "leer-fit@example.com");

    await request(app).put(`${ACCOUNT_BASE}/fit`).set("Cookie", cookieHeader(cookies)).send({ heightCm: 175, rideStyle: "balanced" });
    const res = await request(app).get(ACCOUNT_BASE).set("Cookie", cookieHeader(cookies));

    expect(res.body.data.account.fit).toMatchObject({ heightCm: 175, rideStyle: "balanced" });
  });

  it("rejects a duplicate gear size category", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "categoria-duplicada@example.com");

    const res = await request(app)
      .put(`${ACCOUNT_BASE}/fit`)
      .set("Cookie", cookieHeader(cookies))
      .send({
        gearSizes: [
          { category: "helmet", value: "M" },
          { category: "helmet", value: "L" },
        ],
      });

    expect(res.status).toBe(400);
  });

  it("rejects a category outside the enum", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "categoria-invalida@example.com");

    const res = await request(app)
      .put(`${ACCOUNT_BASE}/fit`)
      .set("Cookie", cookieHeader(cookies))
      .send({ gearSizes: [{ category: "jersey", value: "M" }] });

    expect(res.status).toBe(400);
  });

  it("rejects a height outside the valid range", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "estatura-invalida@example.com");

    const res = await request(app).put(`${ACCOUNT_BASE}/fit`).set("Cookie", cookieHeader(cookies)).send({ heightCm: 300 });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid ride style", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "estilo-invalido@example.com");

    const res = await request(app).put(`${ACCOUNT_BASE}/fit`).set("Cookie", cookieHeader(cookies)).send({ rideStyle: "extreme" });

    expect(res.status).toBe(400);
  });
});
