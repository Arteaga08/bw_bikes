import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { cookieHeader, parseCookies } from "./helpers/cookies.js";
import { createUser } from "./helpers/factories.js";

const AUTH_BASE = "/api/v1/auth";
const ACCOUNT_BASE = "/api/v1/account";

async function loginAndGetCookies(
  app: ReturnType<typeof buildApp>,
  email: string,
  password: string,
): Promise<Record<string, string>> {
  const res = await request(app).post(`${AUTH_BASE}/login`).send({ email, password });
  return parseCookies(res);
}

describe("account profile", () => {
  it("GET /account requires a session", async () => {
    const app = buildApp();
    const res = await request(app).get(ACCOUNT_BASE);
    expect(res.status).toBe(401);
  });

  it("GET /account returns the customer's profile", async () => {
    const app = buildApp();
    const email = "perfil@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, firstName: "Ana", lastName: "Pérez", emailVerified: true });

    const cookies = await loginAndGetCookies(app, email, password);
    const res = await request(app).get(ACCOUNT_BASE).set("Cookie", cookieHeader(cookies));

    expect(res.status).toBe(200);
    expect(res.body.data.account).toMatchObject({
      firstName: "Ana",
      lastName: "Pérez",
      email,
    });
  });

  it("PATCH /account/profile updates the profile fields", async () => {
    const app = buildApp();
    const email = "actualiza-perfil@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, emailVerified: true });

    const cookies = await loginAndGetCookies(app, email, password);
    const res = await request(app)
      .patch(`${ACCOUNT_BASE}/profile`)
      .set("Cookie", cookieHeader(cookies))
      .send({ firstName: "Nuevo", lastName: "Nombre", phone: "5512345678", city: "CDMX", birthDate: "1990-05-10" });

    expect(res.status).toBe(200);
    expect(res.body.data.account).toMatchObject({
      firstName: "Nuevo",
      lastName: "Nombre",
      phone: "5512345678",
      city: "CDMX",
    });
    expect(res.body.data.account.birthDate).toContain("1990-05-10");
  });

  it("PATCH /account/profile validates field limits", async () => {
    const app = buildApp();
    const email = "limites-perfil@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, emailVerified: true });

    const cookies = await loginAndGetCookies(app, email, password);
    const res = await request(app)
      .patch(`${ACCOUNT_BASE}/profile`)
      .set("Cookie", cookieHeader(cookies))
      .send({ phone: "12345" });

    expect(res.status).toBe(400);
  });

  it("POST /account/password rejects an incorrect current password", async () => {
    const app = buildApp();
    const email = "password-incorrecta@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, emailVerified: true });

    const cookies = await loginAndGetCookies(app, email, password);
    const res = await request(app)
      .post(`${ACCOUNT_BASE}/password`)
      .set("Cookie", cookieHeader(cookies))
      .send({ currentPassword: "Wrong-Password-1", newPassword: "New-Password-2" });

    expect(res.status).toBe(401);
  });

  it("POST /account/password accepts the correct current password and revokes refresh tokens issued before it", async () => {
    const app = buildApp();
    const email = "cambia-password@example.com";
    const oldPassword = "Correct-Horse-1";
    const newPassword = "New-Password-2";
    await createUser({ email, password: oldPassword, emailVerified: true });

    const cookies = await loginAndGetCookies(app, email, oldPassword);

    const res = await request(app)
      .post(`${ACCOUNT_BASE}/password`)
      .set("Cookie", cookieHeader(cookies))
      .send({ currentPassword: oldPassword, newPassword });
    expect(res.status).toBe(200);

    // The refresh token issued before the change no longer works.
    const refreshRes = await request(app)
      .post(`${AUTH_BASE}/refresh`)
      .set("Cookie", cookieHeader({ bw_refresh: cookies["bw_refresh"]! }));
    expect(refreshRes.status).toBe(401);

    // Old password rejected, new password accepted.
    const loginOldRes = await request(app).post(`${AUTH_BASE}/login`).send({ email, password: oldPassword });
    expect(loginOldRes.status).toBe(401);

    const loginNewRes = await request(app).post(`${AUTH_BASE}/login`).send({ email, password: newPassword });
    expect(loginNewRes.status).toBe(200);
  });
});
