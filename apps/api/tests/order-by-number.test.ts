import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createCustomerSession } from "./helpers/admin-session.js";
import { createInventoryItemDoc, seedBikeWithVariant } from "./helpers/factories.js";
import { setShippingAddress } from "./helpers/shipping.js";
import { stubStripe } from "./helpers/stripe.js";

const CART = "/api/v1/cart";
const ORDERS = "/api/v1/orders";

type App = ReturnType<typeof buildApp>;

describe("GET /orders/number/:orderNumber", () => {
  let app: App;
  let alice: string;
  let bob: string;
  let bike: Awaited<ReturnType<typeof seedBikeWithVariant>>;

  beforeEach(async () => {
    app = buildApp();
    alice = await createCustomerSession(app, "alice@example.com");
    bob = await createCustomerSession(app, "bob@example.com");
    await setShippingAddress(app, alice);
    await setShippingAddress(app, bob);
    stubStripe();
    bike = await seedBikeWithVariant({ sku: "BK-NUM-M", price: 19_999_900 });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 10 });
  });

  async function placeOrder(cookie: string): Promise<string> {
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    expect(res.status).toBe(201);
    return res.body.data.order.orderNumber as string;
  }

  it("finds an order by its own number", async () => {
    const orderNumber = await placeOrder(alice);

    const res = await request(app).get(`${ORDERS}/number/${orderNumber}`).set("Cookie", alice);

    expect(res.status).toBe(200);
    expect(res.body.data.order.orderNumber).toBe(orderNumber);
  });

  it("is case-insensitive on the URL", async () => {
    const orderNumber = await placeOrder(alice);

    const res = await request(app).get(`${ORDERS}/number/${orderNumber.toLowerCase()}`).set("Cookie", alice);

    expect(res.status).toBe(200);
    expect(res.body.data.order.orderNumber).toBe(orderNumber);
  });

  it("answers 404 on a number that does not exist", async () => {
    const res = await request(app).get(`${ORDERS}/number/BW-2026-ZZZZZZ`).set("Cookie", alice);

    expect(res.status).toBe(404);
  });

  it("answers 404, not 403, on another customer's order number", async () => {
    const bobsOrderNumber = await placeOrder(bob);

    const res = await request(app).get(`${ORDERS}/number/${bobsOrderNumber}`).set("Cookie", alice);

    expect(res.status).toBe(404);
  });

  it("answers 400 on an invalid format, without touching the database", async () => {
    const res = await request(app).get(`${ORDERS}/number/not-a-real-order-number`).set("Cookie", alice);

    expect(res.status).toBe(400);
  });

  it("requires a session", async () => {
    const orderNumber = await placeOrder(alice);

    const res = await request(app).get(`${ORDERS}/number/${orderNumber}`);

    expect(res.status).toBe(401);
  });
});
