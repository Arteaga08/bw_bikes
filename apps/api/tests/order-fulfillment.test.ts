import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { AuditLog, Order } from "../src/models/index.js";
import { stubMailer } from "../src/services/mailer/stub.mailer.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { createInventoryItemDoc, seedBikeWithVariant } from "./helpers/factories.js";
import { captureNextOrderDeliveredEmail, captureNextOrderProcessingEmail, captureNextShipmentNotification } from "./helpers/mailer.js";
import { sampleShippingAddress, setShippingAddress } from "./helpers/shipping.js";
import { paymentIntentObject, signStripeEvent, stubStripe } from "./helpers/stripe.js";

const CART = "/api/v1/cart";
const ORDERS = "/api/v1/orders";
const ADMIN = "/api/v1/admin";
const WEBHOOK = "/api/v1/webhooks/stripe";

type App = ReturnType<typeof buildApp>;

describe("shipping address and fulfillment (M6)", () => {
  let app: App;
  let cookie: string;
  let adminCookie: string;
  let stripe: ReturnType<typeof stubStripe>;
  let bike: Awaited<ReturnType<typeof seedBikeWithVariant>>;

  beforeEach(async () => {
    app = buildApp();
    cookie = await createCustomerSession(app, "fulfillment-buyer@example.com");
    await setShippingAddress(app, cookie);
    adminCookie = await createAdminSession(app);
    stripe = stubStripe();
    bike = await seedBikeWithVariant({ sku: "BK-FUL-M", price: 19_999_900 });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 5 });
  });

  /** Runs a real checkout for the in-stock bike above; returns the order and its gateway payment id. */
  async function checkout(): Promise<{ orderId: string; intentId: string }> {
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    expect(res.status).toBe(201);
    return { orderId: res.body.data.order.id as string, intentId: stripe.lastIntentId() };
  }

  /** Walks the order to `paid` through the real webhook — an in-stock cart captures immediately. */
  async function paidOrder(): Promise<string> {
    const { orderId, intentId } = await checkout();
    const { body, signature } = signStripeEvent({
      type: "payment_intent.succeeded",
      object: paymentIntentObject({ id: intentId, orderId }),
    });
    await request(app).post(WEBHOOK).set("stripe-signature", signature).type("application/json").send(body);
    return orderId;
  }

  /** Walks the order to `processing` — today's only door to it is the bulk endpoint. */
  async function processingOrder(): Promise<string> {
    const orderId = await paidOrder();
    const res = await request(app)
      .patch(`${ADMIN}/orders/bulk-status`)
      .set("Cookie", adminCookie)
      .send({ orderIds: [orderId], status: "processing" });
    expect(res.status).toBe(200);
    return orderId;
  }


  describe("PUT /cart/shipping-address", () => {
    it("saves the address and reflects it on the cart", async () => {
      const res = await request(app)
        .put(`${CART}/shipping-address`)
        .set("Cookie", cookie)
        .send(sampleShippingAddress({ city: "Guadalajara" }));

      expect(res.status).toBe(200);
      expect(res.body.data.cart.shippingAddress).toMatchObject({ city: "Guadalajara", country: "MX" });

      const cart = await request(app).get(CART).set("Cookie", cookie);
      expect(cart.body.data.cart.shippingAddress.city).toBe("Guadalajara");
    });

    it("rejects a malformed postal code", async () => {
      const res = await request(app)
        .put(`${CART}/shipping-address`)
        .set("Cookie", cookie)
        .send(sampleShippingAddress({ postalCode: "abc" }));

      expect(res.status).toBe(400);
    });

    it("rejects a phone that is not 10 digits", async () => {
      const res = await request(app)
        .put(`${CART}/shipping-address`)
        .set("Cookie", cookie)
        .send(sampleShippingAddress({ phone: "12345" }));

      expect(res.status).toBe(400);
    });

    it("rejects a state outside the closed list", async () => {
      const body = { ...sampleShippingAddress(), state: "Narnia" };
      const res = await request(app).put(`${CART}/shipping-address`).set("Cookie", cookie).send(body);

      expect(res.status).toBe(400);
    });

    it("requires authentication", async () => {
      const res = await request(app).put(`${CART}/shipping-address`).send(sampleShippingAddress());
      expect(res.status).toBe(401);
    });
  });

  describe("checkout requires an address", () => {
    it("refuses with 400 and holds nothing when the cart has no shipping address", async () => {
      const bare = await createCustomerSession(app, "no-address-buyer@example.com");
      await request(app)
        .post(`${CART}/lines`)
        .set("Cookie", bare)
        .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });

      const res = await request(app).post(ORDERS).set("Cookie", bare).send({ termsAcceptedAt: new Date().toISOString() });

      expect(res.status).toBe(400);
      expect(await Order.countDocuments()).toBe(0);
      expect(stripe.createPayment).not.toHaveBeenCalled();
    });

    it("copies the cart's address onto the order as a snapshot", async () => {
      const { orderId } = await checkout();
      const order = await Order.findById(orderId).exec();
      expect(order?.shippingAddress.city).toBe("Ciudad de México");
    });
  });

  describe("PATCH /admin/orders/:id/shipping-address", () => {
    it("updates the destination while the order is still open", async () => {
      const { orderId } = await checkout();

      const res = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipping-address`)
        .set("Cookie", adminCookie)
        .send(sampleShippingAddress({ street: "Calle Corregida 45" }));

      expect(res.status).toBe(200);
      expect(res.body.data.order.shippingAddress.street).toBe("Calle Corregida 45");
      expect(await AuditLog.findOne({ action: "order.shipping_address_updated" }).exec()).not.toBeNull();
    });

    it("refuses to correct the address once the order has shipped", async () => {
      const orderId = await processingOrder();
      await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipment`)
        .set("Cookie", adminCookie)
        .send({ carrier: "dhl", trackingNumber: "1234567890" });

      const res = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipping-address`)
        .set("Cookie", adminCookie)
        .send(sampleShippingAddress());

      expect(res.status).toBe(409);
    });

    it("refuses a customer and an anonymous caller", async () => {
      const { orderId } = await checkout();

      const asCustomer = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipping-address`)
        .set("Cookie", cookie)
        .send(sampleShippingAddress());
      const anonymous = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipping-address`)
        .send(sampleShippingAddress());

      expect(asCustomer.status).toBe(403);
      expect(anonymous.status).toBe(401);
    });
  });

  describe("PATCH /admin/orders/:id/shipment", () => {
    it("captures the tracking number and drives processing → shipped in one write", async () => {
      const orderId = await processingOrder();
      const before = await Order.findById(orderId).exec();
      const historyLengthBefore = before!.statusHistory.length;

      const res = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipment`)
        .set("Cookie", adminCookie)
        .send({ carrier: "dhl", trackingNumber: "1234567890" });

      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe("shipped");
      expect(res.body.data.order.shipment).toMatchObject({ carrier: "dhl", trackingNumber: "1234567890" });
      expect(res.body.data.order.shipment.trackingUrl).toContain("dhl.com");

      const after = await Order.findById(orderId).exec();
      // Exactly one new entry — the tracking data and the status change
      // landed together, not as two separate writes.
      expect(after!.statusHistory.length).toBe(historyLengthBefore + 1);
      expect(await AuditLog.findOne({ action: "order.shipped" }).exec()).not.toBeNull();
    });

    it("emails the customer once, only on the real processing → shipped transition", async () => {
      const orderId = await processingOrder();
      const capture = captureNextShipmentNotification();

      await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipment`)
        .set("Cookie", adminCookie)
        .send({ carrier: "dhl", trackingNumber: "1234567890" });

      const params = capture.getParams();
      expect(params).toMatchObject({
        to: "fulfillment-buyer@example.com",
        trackingNumber: "1234567890",
        carrierName: "DHL",
      });
      expect(params!.trackingUrl).toContain("dhl.com");
      // The order summary names the product, not just its SKU — the SKU
      // means nothing to a customer.
      expect(params!.lines).toMatchObject([{ name: bike.bike.name, qty: 1 }]);

      // Correcting the tracking number afterward must not fire a second
      // "it shipped!" email — the spy above was `mockImplementationOnce`,
      // so a second real call here would leave `stubMailer` un-spied and
      // hit the debug-log path instead of throwing, which is why this
      // asserts the call count directly rather than relying on the spy.
      const secondSpy = vi.spyOn(stubMailer, "sendShipmentNotification");
      await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipment`)
        .set("Cookie", adminCookie)
        .send({ carrier: "dhl", trackingNumber: "0000000000" });
      expect(secondSpy).not.toHaveBeenCalled();
    });

    it("requires carrierName and trackingUrl for an unlisted carrier", async () => {
      const orderId = await processingOrder();

      const res = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipment`)
        .set("Cookie", adminCookie)
        .send({ carrier: "otro", trackingNumber: "XYZ-1" });

      expect(res.status).toBe(400);
    });

    it("accepts an unlisted carrier once carrierName and trackingUrl are supplied", async () => {
      const orderId = await processingOrder();

      const res = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipment`)
        .set("Cookie", adminCookie)
        .send({
          carrier: "otro",
          carrierName: "Mensajería Local",
          trackingNumber: "XYZ-1",
          trackingUrl: "https://tracking.example.com/XYZ-1",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.order.shipment.carrierName).toBe("Mensajería Local");
    });

    it("corrects the tracking number afterward without touching the status", async () => {
      const orderId = await processingOrder();
      await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipment`)
        .set("Cookie", adminCookie)
        .send({ carrier: "dhl", trackingNumber: "1111111111" });

      const res = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipment`)
        .set("Cookie", adminCookie)
        .send({ carrier: "dhl", trackingNumber: "2222222222" });

      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe("shipped");
      expect(res.body.data.order.shipment.trackingNumber).toBe("2222222222");
      expect(await AuditLog.findOne({ action: "order.shipment_updated" }).exec()).not.toBeNull();
    });

    it("rejects capturing a shipment on an order that is not processing or already shipped", async () => {
      const orderId = await paidOrder();

      const res = await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipment`)
        .set("Cookie", adminCookie)
        .send({ carrier: "dhl", trackingNumber: "1234567890" });

      expect(res.status).toBe(409);
    });
  });

  describe("PATCH /admin/orders/bulk-status", () => {
    it("moves several orders independently and reports each outcome", async () => {
      const first = await paidOrder();
      bike = await seedBikeWithVariant({ sku: "BK-FUL-N", price: 19_999_900 });
      await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 5 });
      const second = await paidOrder();

      const res = await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .set("Cookie", adminCookie)
        .send({ orderIds: [first, second], status: "processing" });

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toEqual({ updated: 2, unchanged: 0, rejected: 0 });
      expect(await AuditLog.countDocuments({ action: "order.bulk_status_updated" })).toBe(2);
    });

    it("rejects an invalid transition for one order without affecting the rest of the batch", async () => {
      const processing = await processingOrder();
      const paid = await paidOrder();

      // `delivered` is not reachable directly from `processing` — only from `shipped`.
      const res = await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .set("Cookie", adminCookie)
        .send({ orderIds: [processing, paid], status: "delivered" });

      expect(res.status).toBe(200);
      const byId = new Map(res.body.data.results.map((r: { id: string }) => [r.id, r]));
      expect((byId.get(processing) as { outcome: string }).outcome).toBe("rejected");
      // `paid → delivered` is not a valid edge either, so it is rejected too —
      // the point is that both are reported independently, not that the batch aborts.
      expect((byId.get(paid) as { outcome: string }).outcome).toBe("rejected");
      expect(res.body.data.summary.rejected).toBe(2);
    });

    it("reports an already-there order as unchanged, not as an error", async () => {
      const orderId = await processingOrder();

      const res = await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .set("Cookie", adminCookie)
        .send({ orderIds: [orderId], status: "processing" });

      expect(res.status).toBe(200);
      expect(res.body.data.results[0]).toMatchObject({ outcome: "unchanged" });
    });

    it("refuses a status that isn't allowed in bulk", async () => {
      const orderId = await processingOrder();

      const res = await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .set("Cookie", adminCookie)
        .send({ orderIds: [orderId], status: "shipped" });

      expect(res.status).toBe(400);
    });

    it("refuses a customer and an anonymous caller", async () => {
      const orderId = await paidOrder();

      const asCustomer = await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .set("Cookie", cookie)
        .send({ orderIds: [orderId], status: "processing" });
      const anonymous = await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .send({ orderIds: [orderId], status: "processing" });

      expect(asCustomer.status).toBe(403);
      expect(anonymous.status).toBe(401);
    });

    it("emails the customer when an order enters processing", async () => {
      const orderId = await paidOrder();
      const capture = captureNextOrderProcessingEmail();

      const res = await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .set("Cookie", adminCookie)
        .send({ orderIds: [orderId], status: "processing" });

      expect(res.status).toBe(200);
      const order = await Order.findById(orderId).exec();
      expect(capture.getParams()).toMatchObject({
        to: "fulfillment-buyer@example.com",
        orderNumber: order?.orderNumber,
      });
    });

    it("emails the customer when an order is marked delivered", async () => {
      const orderId = await processingOrder();
      await request(app)
        .patch(`${ADMIN}/orders/${orderId}/shipment`)
        .set("Cookie", adminCookie)
        .send({ carrier: "dhl", trackingNumber: "1234567890" });
      const capture = captureNextOrderDeliveredEmail();

      const res = await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .set("Cookie", adminCookie)
        .send({ orderIds: [orderId], status: "delivered" });

      expect(res.status).toBe(200);
      const order = await Order.findById(orderId).exec();
      expect(capture.getParams()).toMatchObject({
        to: "fulfillment-buyer@example.com",
        orderNumber: order?.orderNumber,
      });
    });

    it("rejects an empty or oversized list of ids", async () => {
      const empty = await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .set("Cookie", adminCookie)
        .send({ orderIds: [], status: "processing" });

      const tooMany = await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .set("Cookie", adminCookie)
        .send({ orderIds: Array.from({ length: 51 }, () => new Types.ObjectId().toString()), status: "processing" });

      expect(empty.status).toBe(400);
      expect(tooMany.status).toBe(400);
    });
  });

  describe("admin order history", () => {
    it("names the acting admin in the status history", async () => {
      const orderId = await paidOrder();
      await request(app)
        .patch(`${ADMIN}/orders/bulk-status`)
        .set("Cookie", adminCookie)
        .send({ orderIds: [orderId], status: "processing" });

      const res = await request(app).get(`${ADMIN}/orders/${orderId}`).set("Cookie", adminCookie);

      const entry = res.body.data.order.statusHistory.find((h: { status: string }) => h.status === "processing");
      expect(entry.actorId).toBeTruthy();
    });
  });
});
