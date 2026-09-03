import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { cookieHeader, parseCookies } from "./helpers/cookies.js";
import { createUser } from "./helpers/factories.js";

const AUTH_BASE = "/api/v1/auth";
const ACCOUNT_BASE = "/api/v1/account";

const VALID_ADDRESS = {
  label: "Casa",
  firstName: "Ana",
  lastName: "Pérez",
  phone: "5512345678",
  street: "Av. Reforma 123",
  neighborhood: "Juárez",
  city: "CDMX",
  state: "Ciudad de México",
  postalCode: "06600",
  country: "MX",
};

async function loginAndGetCookies(
  app: ReturnType<typeof buildApp>,
  email: string,
  password: string,
): Promise<Record<string, string>> {
  const res = await request(app).post(`${AUTH_BASE}/login`).send({ email, password });
  return parseCookies(res);
}

async function loginNewUser(app: ReturnType<typeof buildApp>, email: string): Promise<Record<string, string>> {
  const password = "Correct-Horse-1";
  await createUser({ email, password, emailVerified: true });
  return loginAndGetCookies(app, email, password);
}

describe("account addresses", () => {
  it("GET /account/addresses requires a session", async () => {
    const app = buildApp();
    const res = await request(app).get(`${ACCOUNT_BASE}/addresses`);
    expect(res.status).toBe(401);
  });

  it("POST /account/addresses marks the first address as default automatically", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "primera-direccion@example.com");

    const res = await request(app)
      .post(`${ACCOUNT_BASE}/addresses`)
      .set("Cookie", cookieHeader(cookies))
      .send(VALID_ADDRESS);

    expect(res.status).toBe(201);
    expect(res.body.data.addresses).toHaveLength(1);
    expect(res.body.data.addresses[0]).toMatchObject({ label: "Casa", isDefault: true });
  });

  it("a second address is not marked default", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "segunda-direccion@example.com");

    await request(app).post(`${ACCOUNT_BASE}/addresses`).set("Cookie", cookieHeader(cookies)).send(VALID_ADDRESS);
    const res = await request(app)
      .post(`${ACCOUNT_BASE}/addresses`)
      .set("Cookie", cookieHeader(cookies))
      .send({ ...VALID_ADDRESS, label: "Oficina" });

    expect(res.status).toBe(201);
    const addresses = res.body.data.addresses as Array<{ label: string; isDefault: boolean }>;
    expect(addresses).toHaveLength(2);
    expect(addresses.find((a) => a.label === "Casa")).toMatchObject({ isDefault: true });
    expect(addresses.find((a) => a.label === "Oficina")).toMatchObject({ isDefault: false });
  });

  it("rejects a sixth address with 409", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "limite-direcciones@example.com");

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post(`${ACCOUNT_BASE}/addresses`)
        .set("Cookie", cookieHeader(cookies))
        .send({ ...VALID_ADDRESS, label: `Dirección ${i}` });
      expect(res.status).toBe(201);
    }

    const sixthRes = await request(app)
      .post(`${ACCOUNT_BASE}/addresses`)
      .set("Cookie", cookieHeader(cookies))
      .send({ ...VALID_ADDRESS, label: "Sexta" });

    expect(sixthRes.status).toBe(409);
  });

  it("PATCH /account/addresses/:addressId updates an existing address", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "editar-direccion@example.com");

    const createRes = await request(app)
      .post(`${ACCOUNT_BASE}/addresses`)
      .set("Cookie", cookieHeader(cookies))
      .send(VALID_ADDRESS);
    const addressId = createRes.body.data.addresses[0].id as string;

    const res = await request(app)
      .patch(`${ACCOUNT_BASE}/addresses/${addressId}`)
      .set("Cookie", cookieHeader(cookies))
      .send({ ...VALID_ADDRESS, label: "Casa nueva", city: "Guadalajara" });

    expect(res.status).toBe(200);
    const updated = res.body.data.addresses.find((a: { id: string }) => a.id === addressId);
    expect(updated).toMatchObject({ label: "Casa nueva", city: "Guadalajara" });
  });

  it("marking a new address as default unmarks the previous one", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "marcar-predeterminada@example.com");

    const createRes1 = await request(app)
      .post(`${ACCOUNT_BASE}/addresses`)
      .set("Cookie", cookieHeader(cookies))
      .send(VALID_ADDRESS);
    const firstId = createRes1.body.data.addresses[0].id as string;

    const createRes2 = await request(app)
      .post(`${ACCOUNT_BASE}/addresses`)
      .set("Cookie", cookieHeader(cookies))
      .send({ ...VALID_ADDRESS, label: "Oficina" });
    const secondId = createRes2.body.data.addresses.find((a: { label: string }) => a.label === "Oficina").id as string;

    const res = await request(app)
      .post(`${ACCOUNT_BASE}/addresses/${secondId}/default`)
      .set("Cookie", cookieHeader(cookies))
      .send();

    expect(res.status).toBe(200);
    const addresses = res.body.data.addresses as Array<{ id: string; isDefault: boolean }>;
    expect(addresses.find((a) => a.id === secondId)).toMatchObject({ isDefault: true });
    expect(addresses.find((a) => a.id === firstId)).toMatchObject({ isDefault: false });
  });

  it("deleting the default address promotes the first remaining one", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "eliminar-predeterminada@example.com");

    const createRes1 = await request(app)
      .post(`${ACCOUNT_BASE}/addresses`)
      .set("Cookie", cookieHeader(cookies))
      .send(VALID_ADDRESS);
    const firstId = createRes1.body.data.addresses[0].id as string;

    const createRes2 = await request(app)
      .post(`${ACCOUNT_BASE}/addresses`)
      .set("Cookie", cookieHeader(cookies))
      .send({ ...VALID_ADDRESS, label: "Oficina" });
    const secondId = createRes2.body.data.addresses.find((a: { label: string }) => a.label === "Oficina").id as string;

    const res = await request(app)
      .delete(`${ACCOUNT_BASE}/addresses/${firstId}`)
      .set("Cookie", cookieHeader(cookies));

    expect(res.status).toBe(200);
    const addresses = res.body.data.addresses as Array<{ id: string; isDefault: boolean }>;
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatchObject({ id: secondId, isDefault: true });
  });

  it("deleting the only address leaves an empty book without error", async () => {
    const app = buildApp();
    const cookies = await loginNewUser(app, "eliminar-unica@example.com");

    const createRes = await request(app)
      .post(`${ACCOUNT_BASE}/addresses`)
      .set("Cookie", cookieHeader(cookies))
      .send(VALID_ADDRESS);
    const addressId = createRes.body.data.addresses[0].id as string;

    const res = await request(app)
      .delete(`${ACCOUNT_BASE}/addresses/${addressId}`)
      .set("Cookie", cookieHeader(cookies));

    expect(res.status).toBe(200);
    expect(res.body.data.addresses).toHaveLength(0);
  });
});
