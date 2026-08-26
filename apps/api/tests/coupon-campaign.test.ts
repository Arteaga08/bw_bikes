import { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AuditLog, Coupon, CouponRedemption } from "../src/models/index.js";
import { createAdminSession, createCustomerSession } from "./helpers/admin-session.js";
import { couponCampaignService } from "../src/services/coupon-campaign.service.js";
import { createUser } from "./helpers/factories.js";
import { captureCouponEmails } from "./helpers/mailer.js";

const ADMIN = "/api/v1/admin";

type App = ReturnType<typeof buildApp>;

async function seedCoupon(overrides: Record<string, unknown> = {}) {
  return Coupon.create({
    code: "REGALO10",
    name: "Regalo de temporada",
    type: "percent_off",
    percentOffBps: 1_000,
    ...overrides,
  });
}

async function seedCustomer(email: string, firstName = "Ana") {
  const user = await createUser({ email, password: "Correct-Horse-Customer-1", role: "customer", firstName });
  return String(user._id);
}

describe("Coupon campaigns — sending an existing coupon", () => {
  it("emails the code, the offer and the expiry to each selected customer", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const mailbox = captureCouponEmails();
    const expiresAt = new Date(Date.now() + 30 * 86_400_000);
    const coupon = await seedCoupon({ expiresAt });
    const [uno, dos] = [await seedCustomer("uno@example.com", "Uno"), await seedCustomer("dos@example.com", "Dos")];

    const res = await request(app)
      .post(`${ADMIN}/coupons/${coupon._id}/send`)
      .set("Cookie", adminCookie)
      .send({ userIds: [uno, dos] });

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({ sent: 2, failed: 0, skipped: 0 });

    const sent = mailbox.getAll();
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      to: "uno@example.com",
      firstName: "Uno",
      code: "REGALO10",
      discountLabel: "10% de descuento",
      expiresAt: expiresAt.toISOString(),
    });
  });

  it("spells a fixed-amount offer in pesos", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const mailbox = captureCouponEmails();
    const coupon = await seedCoupon({ type: "amount_off", percentOffBps: undefined, amountOffCents: 50_000 });
    const userId = await seedCustomer("fijo@example.com");

    await request(app).post(`${ADMIN}/coupons/${coupon._id}/send`).set("Cookie", adminCookie).send({ userIds: [userId] });

    expect(mailbox.getAll()[0]!.discountLabel).toBe("$500.00 MXN de descuento");
  });

  /**
   * The reason the loop is serial with a per-recipient catch: one bad address
   * must not cost the other thirty-nine their email.
   */
  it("keeps sending after one recipient fails, and reports which", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const mailbox = captureCouponEmails();
    mailbox.failFor("roto@example.com");
    const coupon = await seedCoupon();
    const ids = [
      await seedCustomer("bueno1@example.com"),
      await seedCustomer("roto@example.com"),
      await seedCustomer("bueno2@example.com"),
    ];

    const res = await request(app)
      .post(`${ADMIN}/coupons/${coupon._id}/send`)
      .set("Cookie", adminCookie)
      .send({ userIds: ids });

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({ sent: 2, failed: 1, skipped: 0 });
    expect(mailbox.getAll().map((email) => email.to)).toEqual(["bueno1@example.com", "bueno2@example.com"]);

    const failed = res.body.data.results.find((row: { status: string }) => row.status === "failed");
    expect(failed.email).toBe("roto@example.com");
  });

  it("reports an id that is not a customer as skipped rather than dropping it", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    captureCouponEmails();
    const coupon = await seedCoupon();

    const res = await request(app)
      .post(`${ADMIN}/coupons/${coupon._id}/send`)
      .set("Cookie", adminCookie)
      .send({ userIds: [String(new Types.ObjectId())] });

    expect(res.body.data.summary).toEqual({ sent: 0, failed: 0, skipped: 1 });
  });

  /**
   * **The security decision of M21.** This is the first email a human writes,
   * and `renderTransactionalEmail` treats its paragraphs as trusted HTML.
   */
  it("escapes an admin message instead of passing markup through to the customer", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const mailbox = captureCouponEmails();
    const coupon = await seedCoupon();
    const userId = await seedCustomer("xss@example.com");

    await request(app)
      .post(`${ADMIN}/coupons/${coupon._id}/send`)
      .set("Cookie", adminCookie)
      .send({ userIds: [userId], message: '<script>alert("xss")</script> Gracias!' });

    const message = mailbox.getAll()[0]!.message!;
    expect(message).not.toContain("<script>");
    expect(message).toContain("&lt;script&gt;");
  });

  /**
   * The claim `escapeMessage` makes: it does not depend on `sanitizeInput`
   * having run. Calling the service directly is the path a script, a job, or
   * a future internal caller would take — no middleware anywhere near it.
   */
  it("escapes raw markup even when called without going through the middleware", async () => {
    const mailbox = captureCouponEmails();
    const coupon = await seedCoupon();
    const userId = await seedCustomer("directo@example.com");

    await couponCampaignService.sendExisting(
      { couponId: String(coupon._id), userIds: [userId], message: '<img src=x onerror="alert(1)">' },
      { actorId: String(new Types.ObjectId()) },
    );

    const message = mailbox.getAll()[0]!.message!;
    expect(message).not.toContain("<img");
    expect(message).toContain("&lt;img");
  });

  it("keeps an admin's line breaks readable", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const mailbox = captureCouponEmails();
    const coupon = await seedCoupon();
    const userId = await seedCustomer("saltos@example.com");

    await request(app)
      .post(`${ADMIN}/coupons/${coupon._id}/send`)
      .set("Cookie", adminCookie)
      .send({ userIds: [userId], message: "Primera línea\nSegunda línea" });

    expect(mailbox.getAll()[0]!.message).toBe("Primera línea<br>Segunda línea");
  });

  /** Sending is not redeeming — a campaign nobody uses has cost the shop nothing. */
  it("does not consume a redemption just by emailing the coupon", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    captureCouponEmails();
    const coupon = await seedCoupon({ maxRedemptionsTotal: 5 });
    const userId = await seedCustomer("noconsume@example.com");

    await request(app).post(`${ADMIN}/coupons/${coupon._id}/send`).set("Cookie", adminCookie).send({ userIds: [userId] });

    expect((await Coupon.findById(coupon._id).exec())?.redemptionCount).toBe(0);
    expect(await CouponRedemption.countDocuments()).toBe(0);
  });

  it("refuses to send a deactivated campaign", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    captureCouponEmails();
    const coupon = await seedCoupon({ isActive: false });
    const userId = await seedCustomer("inactivo@example.com");

    const res = await request(app)
      .post(`${ADMIN}/coupons/${coupon._id}/send`)
      .set("Cookie", adminCookie)
      .send({ userIds: [userId] });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Actívalo");
  });

  it("refuses to send an expired campaign", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    captureCouponEmails();
    const coupon = await seedCoupon({ expiresAt: new Date(Date.now() - 1_000) });
    const userId = await seedCustomer("expirado@example.com");

    const res = await request(app)
      .post(`${ADMIN}/coupons/${coupon._id}/send`)
      .set("Cookie", adminCookie)
      .send({ userIds: [userId] });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("expiró");
  });

  it("records who sent what to how many", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    captureCouponEmails();
    const coupon = await seedCoupon();
    const userId = await seedCustomer("auditoria@example.com");

    await request(app).post(`${ADMIN}/coupons/${coupon._id}/send`).set("Cookie", adminCookie).send({ userIds: [userId] });

    const entry = await AuditLog.findOne({ action: "coupon.emailed" }).lean().exec();
    expect(entry).toBeTruthy();
    expect(entry?.after).toMatchObject({ code: "REGALO10", sent: 1 });
  });

  it("rejects an empty recipient list", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const coupon = await seedCoupon();

    const res = await request(app)
      .post(`${ADMIN}/coupons/${coupon._id}/send`)
      .set("Cookie", adminCookie)
      .send({ userIds: [] });

    expect(res.status).toBe(400);
  });
});

describe("Coupon campaigns — generating a one-off coupon", () => {
  it("mints a single-use code, names it after the customer and emails it", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const mailbox = captureCouponEmails();
    const userId = await seedCustomer("personal@example.com", "Rodrigo");

    const res = await request(app)
      .post(`${ADMIN}/customers/${userId}/coupons`)
      .set("Cookie", adminCookie)
      .send({ type: "percent_off", percentOffBps: 1_500, message: "Gracias por tu compra." });

    expect(res.status).toBe(201);
    expect(res.body.data.coupon).toMatchObject({
      type: "percent_off",
      percentOffBps: 1_500,
      maxRedemptionsTotal: 1,
      maxRedemptionsPerCustomer: 1,
      isActive: true,
    });
    expect(res.body.data.coupon.name).toContain("Rodrigo");
    // Readable off a screen: no I/O/0/1 to mistype.
    expect(res.body.data.coupon.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    const sent = mailbox.getAll();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "personal@example.com", discountLabel: "15% de descuento" });
  });

  it("refuses to mint one for an id that is not a customer", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    captureCouponEmails();

    const res = await request(app)
      .post(`${ADMIN}/customers/${new Types.ObjectId()}/coupons`)
      .set("Cookie", adminCookie)
      .send({ type: "amount_off", amountOffCents: 20_000 });

    expect(res.status).toBe(404);
    expect(await Coupon.countDocuments()).toBe(0);
  });

  it("rejects a payload declaring both a percentage and an amount", async () => {
    const app: App = buildApp();
    const adminCookie = await createAdminSession(app);
    const userId = await seedCustomer("ambos@example.com");

    const res = await request(app)
      .post(`${ADMIN}/customers/${userId}/coupons`)
      .set("Cookie", adminCookie)
      .send({ type: "percent_off", percentOffBps: 1_000, amountOffCents: 50_000 });

    expect(res.status).toBe(400);
  });
});

describe("Coupon campaigns — authorization", () => {
  it("does not let a customer email themselves a coupon", async () => {
    const app: App = buildApp();
    const customerCookie = await createCustomerSession(app);
    const coupon = await seedCoupon();

    const res = await request(app)
      .post(`${ADMIN}/coupons/${coupon._id}/send`)
      .set("Cookie", customerCookie)
      .send({ userIds: [String(new Types.ObjectId())] });

    expect(res.status).toBe(403);
  });

  it("does not let a customer mint one for themselves", async () => {
    const app: App = buildApp();
    const customerCookie = await createCustomerSession(app);

    const res = await request(app)
      .post(`${ADMIN}/customers/${new Types.ObjectId()}/coupons`)
      .set("Cookie", customerCookie)
      .send({ type: "percent_off", percentOffBps: 9_000 });

    expect(res.status).toBe(403);
    expect(await Coupon.countDocuments()).toBe(0);
  });
});
