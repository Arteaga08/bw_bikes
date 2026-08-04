import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Cart, InventoryItem, StockReservation } from "../src/models/index.js";
import { createCustomerSession } from "./helpers/admin-session.js";
import {
  createInventoryItemDoc,
  seedAccessoryWithVariant,
  seedBikeWithVariant,
} from "./helpers/factories.js";
import { Types } from "mongoose";

const CART = "/api/v1/cart";

describe("cart", () => {
  let app: ReturnType<typeof buildApp>;
  let cookie: string;
  let bike: Awaited<ReturnType<typeof seedBikeWithVariant>>;

  beforeEach(async () => {
    app = buildApp();
    cookie = await createCustomerSession(app, "cart-customer@example.com");
    bike = await seedBikeWithVariant({ sku: "BK-CART-M", price: 19_999_900 });
  });

  it("starts empty for a customer who never shopped", async () => {
    const res = await request(app).get(CART).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.cart.lines).toEqual([]);
    expect(res.body.data.cart.totalCents).toBe(0);
    expect(res.body.data.cart.captureMethod).toBe("automatic");
  });

  it("requires authentication — a cart belongs to an account", async () => {
    const res = await request(app).get(CART);
    expect(res.status).toBe(401);
  });

  it("adds a line priced from the catalog, not from the request", async () => {
    const res = await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      // A hostile client sending its own price: it must be stripped by Joi and
      // ignored entirely.
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1, unitPriceCents: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.cart.lines[0]).toMatchObject({
      sku: "BK-CART-M",
      unitPriceCents: 19_999_900,
      qty: 1,
      lineTotalCents: 19_999_900,
    });
  });

  it("never holds stock when a line is added", async () => {
    await createInventoryItemDoc({
      itemId: new Types.ObjectId(bike.itemId),
      sku: bike.sku,
      onHand: 3,
    });

    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 2 });

    const reloaded = await InventoryItem.findOne({ sku: bike.sku }).exec();
    expect(reloaded?.reserved).toBe(0);
    expect(await StockReservation.countDocuments()).toBe(0);
  });

  it("increments the quantity instead of duplicating an existing line", async () => {
    const add = () =>
      request(app)
        .post(`${CART}/lines`)
        .set("Cookie", cookie)
        .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    await add();
    const res = await add();

    expect(res.body.data.cart.lines).toHaveLength(1);
    expect(res.body.data.cart.lines[0].qty).toBe(2);
  });

  it("sets an absolute quantity on update", async () => {
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    const res = await request(app)
      .patch(`${CART}/lines/bike/${bike.sku}`)
      .set("Cookie", cookie)
      .send({ qty: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.cart.lines[0].qty).toBe(4);
  });

  it("removes a line", async () => {
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    const res = await request(app).delete(`${CART}/lines/bike/${bike.sku}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.cart.lines).toEqual([]);
  });

  it("empties the whole cart", async () => {
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    const res = await request(app).delete(CART).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.cart.lines).toEqual([]);
  });

  it("rejects a quantity of zero or a negative one", async () => {
    for (const qty of [0, -3]) {
      const res = await request(app)
        .post(`${CART}/lines`)
        .set("Cookie", cookie)
        .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty });

      expect(res.status).toBe(400);
    }
  });

  it("rejects a product that does not exist without revealing whether the id is real", async () => {
    const res = await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: new Types.ObjectId().toString(), sku: "BK-NOPE-M", qty: 1 });

    expect(res.status).toBe(404);
  });

  it("keeps a line that became unpurchasable, but marks it and blocks checkout", async () => {
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    // The admin archives the product while it sits in someone's cart.
    await bike.bike.updateOne({ isActive: false, archivedAt: new Date() });

    const res = await request(app).get(CART).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.cart.lines[0]).toMatchObject({ isPurchasable: false });
    expect(res.body.data.cart.lines[0].unavailableReason).toBeTruthy();
    expect(res.body.data.cart.hasBlockingLines).toBe(true);
  });

  it("previews manual capture as soon as one line is not in stock", async () => {
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 2 });
    const onRequest = await seedBikeWithVariant({ sku: "BK-REQ-L", fulfillmentMode: "on_request" });

    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    const res = await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: onRequest.itemId, sku: onRequest.sku, qty: 1 });

    expect(res.body.data.cart.captureMethod).toBe("manual");
  });

  it("reports availability for in-stock lines and null for made-to-order ones", async () => {
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 5 });
    const onRequest = await seedBikeWithVariant({ sku: "BK-REQ-M", fulfillmentMode: "on_request" });

    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
    const res = await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: onRequest.itemId, sku: onRequest.sku, qty: 1 });

    const lines = res.body.data.cart.lines as { sku: string; available: number | null }[];
    expect(lines.find((line) => line.sku === "BK-CART-M")?.available).toBe(5);
    expect(lines.find((line) => line.sku === "BK-REQ-M")?.available).toBeNull();
  });

  it("treats an in-stock variant with no inventory row as sold out", async () => {
    // M4's rule: a missing row reads as "no stock", not as an error. A variant
    // the warehouse never stocked is simply not purchasable today.
    const res = await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    expect(res.body.data.cart.lines[0]).toMatchObject({ available: 0, isPurchasable: false });
  });

  it("totals only the lines that can actually be paid for", async () => {
    const accessory = await seedAccessoryWithVariant({ sku: "AC-SUM-U", price: 4_500_00 });
    await createInventoryItemDoc({
      itemType: "accessory",
      itemId: new Types.ObjectId(accessory.itemId),
      sku: accessory.sku,
      onHand: 2,
    });

    // The bike has no inventory row, so it is blocked; the helmet is not.
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
    const res = await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "accessory", itemId: accessory.itemId, sku: accessory.sku, qty: 1 });

    // Showing a total the customer cannot pay would be a lie; the blocked line
    // is still listed, just not counted.
    expect(res.body.data.cart.lines).toHaveLength(2);
    expect(res.body.data.cart.subtotalCents).toBe(4_500_00);
    expect(res.body.data.cart.hasBlockingLines).toBe(true);
  });

  it("mixes both catalogs in one cart", async () => {
    const accessory = await seedAccessoryWithVariant({ sku: "AC-CART-U", price: 4_500_00 });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 1 });
    await createInventoryItemDoc({
      itemType: "accessory",
      itemId: new Types.ObjectId(accessory.itemId),
      sku: accessory.sku,
      onHand: 5,
    });

    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
    const res = await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "accessory", itemId: accessory.itemId, sku: accessory.sku, qty: 2 });

    expect(res.body.data.cart.lines).toHaveLength(2);
    expect(res.body.data.cart.subtotalCents).toBe(19_999_900 + 2 * 4_500_00);
  });

  it("keeps two customers' carts entirely separate", async () => {
    const other = await createCustomerSession(app, "other-customer@example.com");

    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

    const res = await request(app).get(CART).set("Cookie", other);

    expect(res.body.data.cart.lines).toEqual([]);
    expect(await Cart.countDocuments()).toBe(2);
  });
});
