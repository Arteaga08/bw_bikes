import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { Cart, Coupon, CouponRedemption, Order } from "../src/models/index.js";
import { createCustomerSession } from "./helpers/admin-session.js";
import { orderService } from "../src/services/order.service.js";
import { createInventoryItemDoc, seedBikeWithVariant } from "./helpers/factories.js";
import { setShippingAddress } from "./helpers/shipping.js";
import { stubStripe } from "./helpers/stripe.js";

const CART = "/api/v1/cart";
const ORDERS = "/api/v1/orders";

/**
 * Where the discount stops being a preview and becomes money: what the gateway
 * is asked to charge, what the order freezes, and what happens to the
 * redemption when the same checkout arrives twice or the order dies unpaid.
 */
describe("checkout with a coupon", () => {
  let app: ReturnType<typeof buildApp>;
  let cookie: string;
  let bike: Awaited<ReturnType<typeof seedBikeWithVariant>>;

  beforeEach(async () => {
    app = buildApp();
    cookie = await createCustomerSession(app, "coupon-buyer@example.com");
    await setShippingAddress(app, cookie);
    bike = await seedBikeWithVariant({ sku: "BK-CPN-M", price: 1_000_000 });
    await createInventoryItemDoc({ itemId: new Types.ObjectId(bike.itemId), sku: bike.sku, onHand: 5 });

    await Coupon.create({
      code: "PRUEBA10",
      name: "Campaña de prueba",
      type: "percent_off",
      percentOffBps: 1_000,
      maxRedemptionsPerCustomer: 5,
    });

    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
    await request(app).post(`${CART}/coupon`).set("Cookie", cookie).send({ code: "PRUEBA10" });
  });

  it("asks the gateway for the discounted amount", async () => {
    const stripe = stubStripe();

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.data.order.totals.discountCents).toBe(100_000);
    expect(res.body.data.order.totals.totalCents).toBe(900_000);
    expect(stripe.createPayment).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 900_000 }));
  });

  it("freezes the coupon onto the order", async () => {
    stubStripe();

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(res.body.data.order.coupon).toMatchObject({
      code: "PRUEBA10",
      type: "percent_off",
      discountCents: 100_000,
    });

    const stored = await Order.findById(res.body.data.order.id).exec();
    expect(stored?.discountCents).toBe(100_000);
  });

  it("derives the order's IVA from the discounted total", async () => {
    stubStripe();

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(res.body.data.order.totals.taxCents).toBe(Math.round((900_000 * 1_600) / 11_600));
  });

  it("records exactly one redemption", async () => {
    stubStripe();

    await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(await CouponRedemption.countDocuments()).toBe(1);
    const coupon = await Coupon.findOne({ code: "PRUEBA10" }).exec();
    expect(coupon?.redemptionCount).toBe(1);
  });

  /**
   * The guarantee the ledger's unique `{couponId, orderId}` index exists for.
   * A retried checkout resolves to the same order via `replayCheckout`, which
   * reuses the frozen total and must not spend a second redemption.
   */
  it("does not spend a second redemption when the same checkout is retried", async () => {
    stubStripe();
    const key = "idem-coupon-1";

    const first = await request(app).post(ORDERS).set("Cookie", cookie).set("Idempotency-Key", key).send({ termsAcceptedAt: new Date().toISOString() });
    const second = await request(app).post(ORDERS).set("Cookie", cookie).set("Idempotency-Key", key).send({ termsAcceptedAt: new Date().toISOString() });

    expect(second.body.data.order.id).toBe(first.body.data.order.id);
    expect(second.body.data.order.totals.totalCents).toBe(900_000);

    const coupon = await Coupon.findOne({ code: "PRUEBA10" }).exec();
    expect(coupon?.redemptionCount).toBe(1);
    expect(await CouponRedemption.countDocuments()).toBe(1);
  });

  it("returns the redemption to the pool when the order is cancelled unpaid", async () => {
    stubStripe();

    const created = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    expect((await Coupon.findOne({ code: "PRUEBA10" }).exec())?.redemptionCount).toBe(1);

    const order = await Order.findById(created.body.data.order.id).exec();
    await orderService.markCanceled(order!, "cancelled", "Prueba de liberación.");

    const coupon = await Coupon.findOne({ code: "PRUEBA10" }).exec();
    expect(coupon?.redemptionCount).toBe(0);
    expect(await CouponRedemption.countDocuments()).toBe(0);
  });

  /**
   * A second checkout supersedes the first (`cancelStalePendingOrders`). The
   * abandoned order gives its redemption back and the new one takes it, so an
   * indecisive customer does not quietly burn a campaign's allowance.
   */
  it("moves the redemption to the new order when a checkout supersedes an earlier one", async () => {
    stubStripe();

    const first = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    await request(app)
      .post(`${CART}/lines`)
      .set("Cookie", cookie)
      .send({ itemType: "bike", itemId: bike.itemId, sku: bike.sku, qty: 1 });
    await request(app).post(`${CART}/coupon`).set("Cookie", cookie).send({ code: "PRUEBA10" });
    const second = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    const coupon = await Coupon.findOne({ code: "PRUEBA10" }).exec();
    expect(coupon?.redemptionCount).toBe(1);

    const ledger = await CouponRedemption.find().exec();
    expect(ledger).toHaveLength(1);
    expect(String(ledger[0]!.orderId)).toBe(second.body.data.order.id);
    expect(String(ledger[0]!.orderId)).not.toBe(first.body.data.order.id);
  });

  it("charges full price for a checkout with no coupon on the cart", async () => {
    stubStripe();
    await request(app).delete(`${CART}/coupon`).set("Cookie", cookie);

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(res.body.data.order.totals.discountCents).toBe(0);
    expect(res.body.data.order.totals.totalCents).toBe(1_000_000);
    expect(res.body.data.order.coupon).toBeUndefined();
    expect(await CouponRedemption.countDocuments()).toBe(0);
  });

  /**
   * The cart's preview is not authority. A campaign that ran out between the
   * customer applying it and pressing "Pagar" must stop the checkout, not
   * silently charge them the discounted amount.
   */
  it("refuses the checkout when the campaign ran out after the cart was priced", async () => {
    stubStripe();
    await Coupon.updateOne({ code: "PRUEBA10" }, { $set: { isActive: false } }).exec();

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    expect(res.status).toBe(404);
    expect(await Order.countDocuments()).toBe(0);
  });

  /**
   * The refusal above used to leave the customer stuck: the cart's own
   * `GET` evaluates the same code quietly and showed no coupon at all, so
   * there was nothing on screen to remove and every retry hit the same 409.
   * Now that same quiet render drops the dead code from the stored cart, so
   * a customer who just goes back and tries again — no manual cleanup —
   * checks out fine, at full price.
   */
  it("recovers on its own from a coupon that a strict checkout just refused", async () => {
    stubStripe();
    await Coupon.updateOne({ code: "PRUEBA10" }, { $set: { isActive: false } }).exec();
    await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });

    const cart = await request(app).get(CART).set("Cookie", cookie);
    expect(cart.body.data.cart.coupon).toBeUndefined();
    expect((await Cart.findOne({}).exec())?.couponCode).toBeUndefined();

    const res = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    expect(res.status).toBe(201);
    expect(res.body.data.order.totals.discountCents).toBe(0);
  });

  /**
   * The redemption is spent, so the code has to leave with the lines it paid
   * for. Leaving it behind made the customer's *next* checkout re-apply a
   * coupon they never typed again and get refused with "Ya usaste este cupón"
   * — while the cart, which evaluates quietly, showed no coupon to remove.
   */
  it("clears the coupon from the cart once the order is paid", async () => {
    stubStripe();

    const created = await request(app).post(ORDERS).set("Cookie", cookie).send({ termsAcceptedAt: new Date().toISOString() });
    const order = await Order.findById(created.body.data.order.id).exec();
    await orderService.markPaid(order!, new Date());

    const cart = await Cart.findOne({ userId: order!.userId }).exec();
    expect(cart?.lines).toEqual([]);
    expect(cart?.couponCode).toBeUndefined();
  });
});
