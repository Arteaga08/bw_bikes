import Stripe from "stripe";
import { connectDb, disconnectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Accessory, AccessoryCategory, Bike, BikeCategory, Brand, InventoryItem, Order, User } from "../models/index.js";
import type { ActorContext } from "../services/product.service.js";
import { orderMaintenanceService } from "../services/order-maintenance.service.js";
import { orderService } from "../services/order.service.js";
import { settingsService } from "../services/settings.service.js";
import { slugify } from "../utils/index.js";

/**
 * Seeds a small, fixed set of E2E-only orders for the Playwright suite
 * (`apps/e2e`) — one per reachable `OrderStatus`, plus a second
 * `awaiting_supplier_confirmation` order and one closed-lost dispute, run
 * against the isolated `mongodb-memory-server` instance `e2e-mongo.ts` boots
 * (never against a developer's real Atlas cluster).
 *
 * ## Why this doesn't need `stripe listen`, unlike `seed-batch-orders.ts`
 *
 * That script drives every transition through the real webhook so it can
 * also prove notification delivery — this one only needs to leave orders in
 * the right *state* for a browser to click through. `markAuthorized`,
 * `markPaid`, `markRefunded`, `markDisputed`, and `closeDispute` are exported
 * on `orderService` precisely because the webhook handler itself is just a
 * caller of them (see `payment-webhook.service.ts`). So each transition here
 * makes the real, synchronous Stripe test-mode API call first (confirm,
 * capture, refund — whatever actually moves money or authorization state),
 * then calls the same function the webhook would have called with that real
 * result — never a raw `$set` on `status`. Two `awaiting_supplier_confirmation`
 * orders are deliberately left mid-lifecycle: `apps/e2e`'s own Órdenes specs
 * click "Confirmar"/"Rechazar" on them for real, exercising the one admin
 * action in this shop that captures/cancels real (test-mode) money.
 *
 * The one exception is the closed-lost dispute: Stripe resolves a real test
 * dispute on its own asynchronous schedule (minutes), which is exactly what
 * `seed-batch-orders.ts` already proved end-to-end. Re-proving that webhook
 * chain isn't this script's job — its only job is giving `DisputeStatusBadge`
 * something real to render — so `markDisputed`/`closeDispute` are called
 * directly with a synthetic but plausible timestamp.
 *
 *   pnpm --filter @bw-bikes/api seed:e2e-orders
 *
 * Requires `apps/api` running against the fixed e2e Mongo (`e2e-mongo.ts`)
 * and real Stripe test-mode credentials in `MONGODB_URI`/`STRIPE_SECRET_KEY`
 * — both already true for the `apps/e2e` `webServer` entry that runs this as
 * part of `global-setup.ts`.
 */

const BRAND_NAME = "E2E Trek";
const BIKE_NAME = "E2E Trek Domane SL6";
const ACCESSORY_NAME = "E2E Casco Trek Verve";

const BIKE_SKU_IN_STOCK = "E2E-TREK-DOMANE-M-RED";
const BIKE_SKU_ON_REQUEST = "E2E-TREK-DOMANE-L-BLK";
const ACCESSORY_SKU_IN_STOCK = "E2E-TREK-VERVE-U-BLK";
const ACCESSORY_SKU_ON_REQUEST = "E2E-TREK-VERVE-U-WHT";

const BIKE_PRICE_CENTS = 6_200_000; // $62,000.00 MXN
const ACCESSORY_PRICE_CENTS = 320_000; // $3,200.00 MXN
const BIKE_STOCK_UNITS = 20;
const ACCESSORY_STOCK_UNITS = 20;

const TEST_CUSTOMER_EMAIL = "e2e-customer@bw-bikes-seed.com";
const TEST_CUSTOMER_PASSWORD = "PruebaBW2026E2E!";
const PENDING_CUSTOMER_PASSWORD = "PruebaBW2026E2EPending!";
function pendingCustomerEmail(index: number): string {
  return `e2e-pending-${index}@bw-bikes-seed.com`;
}

const TEST_SHIPPING_ADDRESS = {
  recipientName: "Cliente E2E",
  phone: "5555555555",
  street: "Av. Insurgentes Sur 1234",
  neighborhood: "Del Valle",
  city: "Ciudad de México",
  state: "Ciudad de México",
  postalCode: "03100",
  country: "MX",
};

const API_BASE_URL = `http://localhost:${env.port}/api/v1`;

function fail(message: string): never {
  logger.error(`[seed-e2e-orders] ${message}`);
  process.exit(1);
}

function assertPreconditions(): void {
  if (env.isProduction) fail("Refusing to run against NODE_ENV=production.");
  if (!env.stripeSecretKey.startsWith("sk_test_")) {
    fail("STRIPE_SECRET_KEY must be a test-mode key (sk_test_...).");
  }
}

// --- Catalog (self-contained: creates its own category if none exists) ----

interface CatalogRefs {
  bikeId: string;
  accessoryId: string;
}

async function upsertCatalog(): Promise<CatalogRefs> {
  const brand = await Brand.findOneAndUpdate(
    { name: BRAND_NAME },
    { $setOnInsert: { name: BRAND_NAME, slug: slugify(BRAND_NAME) } },
    { upsert: true, new: true },
  ).exec();

  const bikeCategory = await BikeCategory.findOneAndUpdate(
    { slug: "e2e-bicicletas" },
    { $setOnInsert: { name: "E2E Bicicletas", slug: "e2e-bicicletas", parent: null } },
    { upsert: true, new: true },
  ).exec();

  const accessoryCategory = await AccessoryCategory.findOneAndUpdate(
    { slug: "e2e-accesorios" },
    { $setOnInsert: { name: "E2E Accesorios", slug: "e2e-accesorios", parent: null } },
    { upsert: true, new: true },
  ).exec();

  let bike = await Bike.findOne({ slug: slugify(BIKE_NAME) }).exec();
  if (!bike) {
    bike = await Bike.create({
      name: BIKE_NAME,
      slug: slugify(BIKE_NAME),
      brand: brand._id,
      category: bikeCategory._id,
      shortDescription: "Bicicleta de prueba para la suite e2e.",
      description: "Producto sembrado por seed-e2e-orders.ts — no forma parte del catálogo real.",
      price: BIKE_PRICE_CENTS,
      variants: [
        { sku: BIKE_SKU_IN_STOCK, size: "M", color: "Rojo Viper", fulfillmentMode: "in_stock", isActive: true },
        { sku: BIKE_SKU_ON_REQUEST, size: "L", color: "Negro Trek", fulfillmentMode: "on_request", isActive: true },
      ],
      summary: [],
      specGroups: [],
      gallery: [],
      isActive: true,
    });
  }

  let accessory = await Accessory.findOne({ slug: slugify(ACCESSORY_NAME) }).exec();
  if (!accessory) {
    accessory = await Accessory.create({
      name: ACCESSORY_NAME,
      slug: slugify(ACCESSORY_NAME),
      brand: brand._id,
      category: accessoryCategory._id,
      description: "Producto sembrado por seed-e2e-orders.ts — no forma parte del catálogo real.",
      price: ACCESSORY_PRICE_CENTS,
      variants: [
        { sku: ACCESSORY_SKU_IN_STOCK, size: "U", color: "Negro", fulfillmentMode: "in_stock", isActive: true },
        { sku: ACCESSORY_SKU_ON_REQUEST, size: "U", color: "Blanco", fulfillmentMode: "on_request", isActive: true },
      ],
      specGroups: [],
      gallery: [],
      isActive: true,
    });
  }

  await topUpInventory("bike", bike._id.toString(), BIKE_SKU_IN_STOCK, BIKE_STOCK_UNITS);
  await topUpInventory("accessory", accessory._id.toString(), ACCESSORY_SKU_IN_STOCK, ACCESSORY_STOCK_UNITS);

  return { bikeId: bike._id.toString(), accessoryId: accessory._id.toString() };
}

async function topUpInventory(itemType: "bike" | "accessory", itemId: string, sku: string, units: number): Promise<void> {
  const existing = await InventoryItem.findOne({ itemType, itemId, sku }).exec();
  if (!existing) {
    await InventoryItem.create({ itemType, itemId, sku, onHand: units });
  } else if (existing.onHand - existing.reserved < units) {
    await InventoryItem.updateOne({ _id: existing._id }, { $set: { onHand: existing.reserved + units } }).exec();
  }
}

async function upsertCustomer(email: string, password: string, lastName: string): Promise<void> {
  const existing = await User.findOne({ email }).select("+password");
  if (existing) {
    existing.password = password;
    existing.emailVerified = true;
    await existing.save();
    return;
  }
  await User.create({ email, password, firstName: "Cliente", lastName, role: "customer", emailVerified: true });
}

// --- Thin HTTP client (customer-facing checkout only) ----------------------

interface ApiEnvelope<T> {
  status: "success" | "fail";
  message: string;
  data?: T;
}

class ApiSession {
  private cookieHeader = "";

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookieHeader ? { Cookie: this.cookieHeader } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (setCookie.length > 0) this.cookieHeader = setCookie.map((entry) => entry.split(";")[0]).join("; ");
    const envelope = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || envelope.status !== "success") {
      throw new Error(`${method} ${path} → ${response.status}: ${envelope.message}`);
    }
    return envelope.data as T;
  }

  async login(email: string, password: string): Promise<void> {
    await this.request("POST", "/auth/login", { email, password });
  }
}

interface PublicOrderLite {
  id: string;
  orderNumber: string;
  status: string;
}

async function purchaseOne(session: ApiSession, itemType: "bike" | "accessory", itemId: string, sku: string): Promise<PublicOrderLite> {
  await session.request("DELETE", "/cart");
  await session.request("PUT", "/cart/shipping-address", TEST_SHIPPING_ADDRESS);
  await session.request("POST", "/cart/lines", { itemType, itemId, sku, qty: 1 });
  const result = await session.request<{ order: PublicOrderLite; clientSecret: string }>("POST", "/orders", {});
  return result.order;
}

/**
 * Confirms the PaymentIntent directly against Stripe's test-mode API (real,
 * synchronous call — no `stripe listen` involved) then advances the local
 * order with the same `orderService` function the webhook would have called.
 * Returns the order's new domain status.
 */
async function confirmAndAdvance(stripe: Stripe, orderId: string): Promise<"authorized" | "paid"> {
  const order = await Order.findById(orderId).exec();
  if (!order?.payment.intentId) fail(`Order ${orderId} has no payment intent to confirm.`);

  const intent = await stripe.paymentIntents.confirm(order.payment.intentId, {
    payment_method: "pm_card_visa",
    return_url: `${env.clientUrl}/checkout/return`,
  });

  if (intent.status === "requires_capture") {
    await orderService.markAuthorized(order, new Date());
    return "authorized";
  }
  if (intent.status === "succeeded") {
    await orderService.markPaid(order, new Date());
    return "paid";
  }
  fail(`Order ${orderId}'s PaymentIntent landed in unexpected status "${intent.status}" after confirm.`);
}

// --- The order plan ---------------------------------------------------

async function run(): Promise<void> {
  assertPreconditions();
  await connectDb();

  try {
    if (!env.isStripeConfigured) fail("STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set.");

    const catalog = await upsertCatalog();
    await upsertCustomer(TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD, "Prueba");

    const adminActorUser = await User.findOne({ role: { $in: ["admin", "superadmin"] } }).sort({ createdAt: 1 }).exec();
    const actor: ActorContext = { actorId: adminActorUser ? adminActorUser._id.toString() : "system-seed-e2e-orders" };

    const stripe = new Stripe(env.stripeSecretKey, { apiVersion: Stripe.API_VERSION, typescript: true });
    const session = new ApiSession();
    await session.login(TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD);

    const settings = await settingsService.get();
    const results: { orderNumber: string; targetStatus: string }[] = [];

    // 1-2: pending_payment — each gets a single-use customer (checkout on the
    // same customer twice would cancel the first via cancelStalePendingOrders).
    for (const [index, product] of (["bike", "accessory"] as const).entries()) {
      const email = pendingCustomerEmail(index + 1);
      await upsertCustomer(email, PENDING_CUSTOMER_PASSWORD, `Pendiente ${index + 1}`);
      const pendingSession = new ApiSession();
      await pendingSession.login(email, PENDING_CUSTOMER_PASSWORD);
      const { itemId, sku } = product === "bike" ? { itemId: catalog.bikeId, sku: BIKE_SKU_IN_STOCK } : { itemId: catalog.accessoryId, sku: ACCESSORY_SKU_IN_STOCK };
      const order = await purchaseOne(pendingSession, product, itemId, sku);
      results.push({ orderNumber: order.orderNumber, targetStatus: "pending_payment" });
    }

    // 3-4: awaiting_supplier_confirmation — left as-is on purpose, for
    // apps/e2e's Órdenes specs to click "Confirmar"/"Rechazar" on for real.
    for (const [product, sku, itemId] of [
      ["bike", BIKE_SKU_ON_REQUEST, catalog.bikeId],
      ["accessory", ACCESSORY_SKU_ON_REQUEST, catalog.accessoryId],
    ] as const) {
      const order = await purchaseOne(session, product, itemId, sku);
      await confirmAndAdvance(stripe, order.id);
      results.push({ orderNumber: order.orderNumber, targetStatus: "awaiting_supplier_confirmation" });
    }

    // 5: authorization_expired — authorize, backdate past the cancel window, sweep.
    {
      const order = await purchaseOne(session, "bike", catalog.bikeId, BIKE_SKU_ON_REQUEST);
      await confirmAndAdvance(stripe, order.id);
      const pastDue = new Date(Date.now() - (settings.orders.orderAuthCancelHours + 24) * 60 * 60 * 1000);
      await Order.updateOne({ _id: order.id }, { $set: { "payment.authorizedAt": pastDue } }).exec();
      await orderMaintenanceService.cancelExpiredAuthorizations(new Date(), settings.orders.orderAuthCancelHours);
      results.push({ orderNumber: order.orderNumber, targetStatus: "authorization_expired" });
    }

    // 6: cancelled — authorize, then the admin rejects it.
    {
      const order = await purchaseOne(session, "accessory", catalog.accessoryId, ACCESSORY_SKU_ON_REQUEST);
      await confirmAndAdvance(stripe, order.id);
      await orderService.rejectSupplierStock(order.id, "Sin stock disponible con el proveedor.", actor);
      results.push({ orderNumber: order.orderNumber, targetStatus: "cancelled" });
    }

    // 7: paid (in_stock — automatic capture, no supplier queue).
    let paidBikeId = "";
    {
      const order = await purchaseOne(session, "bike", catalog.bikeId, BIKE_SKU_IN_STOCK);
      await confirmAndAdvance(stripe, order.id);
      paidBikeId = order.id;
      results.push({ orderNumber: order.orderNumber, targetStatus: "paid" });
    }

    // 8: paid (on_request — via the admin "confirm supplier" path).
    {
      const order = await purchaseOne(session, "accessory", catalog.accessoryId, ACCESSORY_SKU_ON_REQUEST);
      await confirmAndAdvance(stripe, order.id);
      await orderService.confirmSupplierStock(order.id, actor);
      results.push({ orderNumber: order.orderNumber, targetStatus: "paid" });
    }

    // 9: processing.
    let processingId = "";
    {
      const order = await purchaseOne(session, "bike", catalog.bikeId, BIKE_SKU_IN_STOCK);
      await confirmAndAdvance(stripe, order.id);
      await orderService.bulkUpdateStatus([order.id], "processing", undefined, actor);
      processingId = order.id;
      results.push({ orderNumber: order.orderNumber, targetStatus: "processing" });
    }
    void processingId;

    // 10: shipped.
    {
      const order = await purchaseOne(session, "accessory", catalog.accessoryId, ACCESSORY_SKU_IN_STOCK);
      await confirmAndAdvance(stripe, order.id);
      await orderService.bulkUpdateStatus([order.id], "processing", undefined, actor);
      await orderService.recordShipment(order.id, { carrier: "dhl", trackingNumber: "E2E-SHIPPED-001" }, actor);
      results.push({ orderNumber: order.orderNumber, targetStatus: "shipped" });
    }

    // 11: delivered.
    {
      const order = await purchaseOne(session, "bike", catalog.bikeId, BIKE_SKU_IN_STOCK);
      await confirmAndAdvance(stripe, order.id);
      await orderService.bulkUpdateStatus([order.id], "processing", undefined, actor);
      await orderService.recordShipment(order.id, { carrier: "fedex", trackingNumber: "E2E-DELIVERED-001" }, actor);
      await orderService.bulkUpdateStatus([order.id], "delivered", undefined, actor);
      results.push({ orderNumber: order.orderNumber, targetStatus: "delivered" });
    }

    // 12: refunded — real Stripe test-mode refund, then the same function the
    // `charge.refunded` webhook would call.
    {
      const order = await purchaseOne(session, "accessory", catalog.accessoryId, ACCESSORY_SKU_IN_STOCK);
      await confirmAndAdvance(stripe, order.id);
      const fresh = await Order.findById(order.id).exec();
      if (!fresh?.payment.intentId) fail(`Order ${order.id} has no payment intent to refund.`);
      await stripe.refunds.create({ payment_intent: fresh.payment.intentId });
      await orderService.markRefunded(fresh, fresh.totalCents, new Date());
      results.push({ orderNumber: order.orderNumber, targetStatus: "refunded" });
    }

    // 13: disputed (lost) — DisputeStatusBadge coverage only; the real
    // charge.dispute.* webhook chain is already proven end-to-end by
    // seed-batch-orders.ts, so this calls the domain functions directly with
    // a synthetic timestamp rather than waiting minutes for a real Stripe test
    // dispute to resolve.
    if (paidBikeId) {
      const fresh = await Order.findById(paidBikeId).exec();
      if (fresh) {
        const occurredAt = new Date();
        await orderService.markDisputed(fresh, occurredAt, "open");
        await orderService.closeDispute(fresh, "lost", occurredAt);
        results.push({ orderNumber: fresh.orderNumber, targetStatus: "paid (disputeStatus: lost)" });
      }
    }

    logger.info("");
    logger.info(`[seed-e2e-orders] Listo. ${results.length} órdenes sembradas:`);
    for (const r of results) logger.info(`  ${r.orderNumber} — ${r.targetStatus}`);
  } finally {
    await disconnectDb();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, "[seed-e2e-orders] Failed.");
  process.exit(1);
});
