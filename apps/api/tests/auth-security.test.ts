import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { User } from "../src/models/index.js";
import { createUser } from "./helpers/factories.js";

const BASE = "/api/v1/auth";

describe("login anti-enumeration", () => {
  it("gives the exact same message for a nonexistent email and a wrong password", async () => {
    const app = buildApp();
    const email = "real-user@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, emailVerified: true });

    const nonexistentRes = await request(app)
      .post(`${BASE}/login`)
      .send({ email: "nobody-here@example.com", password: "whatever123" });
    const wrongPasswordRes = await request(app).post(`${BASE}/login`).send({ email, password: "wrong-password-1" });

    expect(nonexistentRes.status).toBe(401);
    expect(wrongPasswordRes.status).toBe(401);
    expect(nonexistentRes.body.message).toBe(wrongPasswordRes.body.message);
  });

  it("blocks login for an unverified account only after the password check succeeds", async () => {
    const app = buildApp();
    const email = "unverified@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, emailVerified: false });

    const wrongPassword = await request(app).post(`${BASE}/login`).send({ email, password: "nope-not-it" });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.message).toContain("incorrectos");

    const correctPassword = await request(app).post(`${BASE}/login`).send({ email, password });
    expect(correctPassword.status).toBe(403);
    expect(correctPassword.body.message).toContain("Verifica tu correo");
  });
});

describe("register anti mass-assignment", () => {
  it("ignores a role field on the register payload", async () => {
    const app = buildApp();
    const email = "wannabe-admin@example.com";

    const res = await request(app).post(`${BASE}/register`).send({
      email,
      password: "Correct-Horse-1",
      passwordConfirm: "Correct-Horse-1",
      firstName: "No",
      lastName: "Admin",
      role: "admin",
    });
    expect(res.status).toBe(201);

    const stored = await User.findOne({ email });
    expect(stored?.role).toBe("customer");
  });
});

describe("password never leaks in a response", () => {
  it("omits password from the register and login payloads", async () => {
    const app = buildApp();
    const email = "no-leak@example.com";
    const password = "Correct-Horse-1";
    await createUser({ email, password, emailVerified: true });

    const loginRes = await request(app).post(`${BASE}/login`).send({ email, password });
    expect(loginRes.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(loginRes.body)).not.toContain(password);
  });
});

describe("login rate limiting", () => {
  it("locks out after 5 attempts within the window", async () => {
    const app = buildApp();
    const email = "lockout-target@example.com";
    await createUser({ email, password: "Correct-Horse-1", emailVerified: true });

    const attempts = [];
    for (let i = 0; i < 6; i += 1) {
      attempts.push(await request(app).post(`${BASE}/login`).send({ email, password: "wrong-password" }));
    }

    const statuses = attempts.map((res) => res.status);
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});
