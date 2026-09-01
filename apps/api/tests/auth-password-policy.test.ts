import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createUser } from "./helpers/factories.js";
import { captureNextResetLink, extractToken } from "./helpers/mailer.js";

const BASE = "/api/v1/auth";

describe("register password policy", () => {
  it.each([
    ["missing an uppercase letter", "correct-horse-1"],
    ["missing a number", "Correct-Horse"],
    ["missing a special character", "CorrectHorse1"],
  ])("rejects a password %s", async (_label, password) => {
    const app = buildApp();
    const res = await request(app).post(`${BASE}/register`).send({
      email: "weak-password@example.com",
      password,
      passwordConfirm: password,
      firstName: "Ada",
      lastName: "Byte",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("mayúscula");
  });

  it("accepts a password with an uppercase letter, a number, and a special character", async () => {
    const app = buildApp();
    const res = await request(app).post(`${BASE}/register`).send({
      email: "strong-password@example.com",
      password: "Correct-Horse-1",
      passwordConfirm: "Correct-Horse-1",
      firstName: "Ada",
      lastName: "Byte",
    });

    expect(res.status).toBe(201);
  });
});

describe("reset-password password policy", () => {
  it("rejects a new password missing the required complexity", async () => {
    const app = buildApp();
    const email = "reset-weak-password@example.com";
    await createUser({ email, password: "Old-Password-1", emailVerified: true });

    const captured = captureNextResetLink();
    await request(app).post(`${BASE}/forgot-password`).send({ email });
    const token = extractToken(captured.getUrl());

    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({ token, password: "correcthorse1", passwordConfirm: "correcthorse1" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("mayúscula");
  });
});
