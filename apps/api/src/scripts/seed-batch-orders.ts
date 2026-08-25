import type { DisputeStatus, OrderStatus } from "@bw-bikes/shared";
import Stripe from "stripe";
import { connectDb, disconnectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  Accessory,
  AccessoryCategory,
  Bike,
  BikeCategory,
  Brand,
  InventoryItem,
  Order,
  User,
} from "../models/index.js";
import type { IOrder } from "../models/index.js";
import type { ActorContext } from "../services/product.service.js";
import { orderMaintenanceService } from "../services/order-maintenance.service.js";
import { orderService } from "../services/order.service.js";
import { settingsService } from "../services/settings.service.js";
import { slugify } from "../utils/index.js";

/**
 * Seeds 22 real end-to-end orders (Stripe test mode, real webhooks, real
 * Resend/Telegram notifications) spread over the last two weeks, covering
 * every reachable `OrderStatus` plus both dispute outcomes. Three purposes
 * at once:
 *
 * 1. Give Inicio/Analítica a dataset worth looking at — the previous
 *    `seed-test-orders.ts` only ever produced two orders on the same day,
 *    which is why every sparkline/ranked-bar chart there reads as empty.
 * 2. Exercise the notification paths (`sendOrderPaidEmail`,
 *    `sendShipmentNotification`, `sendOrderDeliveredEmail`,
 *    `sendRefundConfirmedEmail`, the Telegram `order.authorized`/`order.paid`
 *    alerts) for real, against a real inbox — the "pruebas pendientes contra
 *    servicios externos reales" this project has been deferring.
 * 3. Exercise the `charge.dispute.*` chain end-to-end against real Stripe
 *    magic test cards — `pm_card_createDispute` opens one, `winning_evidence`
 *    / `disputes.close` resolve it either way.
 *
 *   pnpm --filter @bw-bikes/api seed:batch-orders
 *
 * ## Before running
 *
 * Same preconditions as `seed-test-orders.ts`: `stripe listen --api-key
 * "$STRIPE_SECRET_KEY" --forward-to localhost:4000/api/v1/webhooks/stripe`
 * running in a separate terminal, `STRIPE_WEBHOOK_SECRET` current, and
 * `pnpm dev:api` up. `RESEND_API_KEY`/`MAIL_FROM` and
 * `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` must also be set — unlike the
 * smaller script, this one is partly *for* exercising those, so it refuses to
 * run against the stub mailer/notifier.
 *
 * ## Why admin transitions bypass HTTP
 *
 * `confirm-supplier-stock`, `bulk-status`, `shipment` all require an
 * admin-role session, and admin login requires a TOTP code a script cannot
 * produce — the same wall `seed-test-orders.ts`'s own header comment
 * documents for catalog writes. So every admin-side transition here calls
 * `orderService`/`orderMaintenanceService` directly, in-process, exactly the
 * functions the real admin routes call — never a raw `$set` on `status`.
 * Only the customer-facing half (cart → checkout → Stripe confirm) goes over
 * real HTTP, because that's the half a customer session can actually do.
 *
 * ## Why `pending_payment` orders get their own throwaway customer
 *
 * `createFromCart` cancels every other `pending_payment` order the same
 * customer already has before creating a new one (`cancelStalePendingOrders`
 * — "one live checkout per customer", `order.service.ts`). The shared
 * `TEST_CUSTOMER_EMAIL` below checks out 20 times in this script, so a
 * `pending_payment` order placed on it would be cancelled by the very next
 * purchase — silently, since nothing here would ever have noticed. Each
 * `pending_payment` spec instead gets a single-use account
 * (`pendingCustomerSession`) that never checks out a second time, so there is
 * never a "next purchase" to cancel it. Their `createdAt` is also **not**
 * backdated (see below) — the payment-reconciliation job will still resolve
 * them to `cancelled` on its own clock, roughly 20-30 minutes after this
 * script finishes, exactly as it would for an abandoned real checkout. Verify
 * `/admin/ordenes` promptly after the run if you want to see them still
 * pending.
 *
 * ## Why `createdAt` is backdated after the fact
 *
 * `orders.stats.ts` windows and buckets everything by `Order.createdAt`
 * alone. Every order here is driven through its real lifecycle *today* (so
 * webhooks and notifications fire for real, right now), then its
 * `createdAt`/`updatedAt` are moved into the target day with a raw
 * `updateOne({ overwriteImmutable: true, timestamps: false })` — the only way
 * Mongoose allows touching an `immutable: true` timestamp after insert. This
 * changes nothing about how the order was produced, only when the dashboard
 * thinks it happened. `pending_payment` orders are excluded from this — see
 * above.
 *
 * ## Why the report at the end re-reads Mongo instead of trusting itself
 *
 * Every step below already waits for its own webhook before moving on, but
 * "the script's local variable says X" and "the database says X" are two
 * different claims, and only the second one is the thing this script exists
 * to verify. The closing report re-fetches every order fresh and compares
 * its real `status`/`disputeStatus` against what the plan asked for,
 * printing `MISMATCH` and exiting non-zero on any disagreement.
 */

const TEST_BRAND_NAME = "Trek";
const BIKE_NAME = "Trek Domane SL6";
const ACCESSORY_NAME = "Casco Trek Verve";

const BIKE_SKU_IN_STOCK = "TREK-DOMANE-M-RED";
const BIKE_SKU_ON_REQUEST = "TREK-DOMANE-L-BLK";
const ACCESSORY_SKU_IN_STOCK = "TREK-VERVE-U-BLK";
const ACCESSORY_SKU_ON_REQUEST = "TREK-VERVE-U-WHT";

const BIKE_PRICE_CENTS = 6_200_000; // $62,000.00 MXN
const ACCESSORY_PRICE_CENTS = 320_000; // $3,200.00 MXN
const BIKE_STOCK_UNITS = 10;
const ACCESSORY_STOCK_UNITS = 15;

// Real address on purpose: `order.service.ts` sends every customer-facing
// notification `to: customer.email` — there is no separate notification-email
// field, so the login identity and the notification recipient are the same
// field. A fake domain here would mean nothing arrives to check.
const TEST_CUSTOMER_EMAIL = "arteaga_manuel88@outlook.com";
const TEST_CUSTOMER_PASSWORD = "PruebaBW2026!";

// Synthetic on purpose, unlike the customer above: a `pending_payment` order
// never fires a customer notification (nothing to confirm yet), so there is
// no real inbox that needs to receive anything for these. `.com`, not the
// RFC 2606 reserved `.test` TLD — Joi's `email()` validator (same one every
// real signup goes through) rejects `.test` as not a real TLD, and this
// address only ever needs to pass that check, never actually deliver.
const PENDING_CUSTOMER_PASSWORD = "PruebaBW2026Pending!";
function pendingCustomerEmail(index: number): string {
  return `seed-pending-${index}@bw-bikes-seed.com`;
}

const TEST_SHIPPING_ADDRESS = {
  recipientName: "Cliente de Prueba",
  phone: "5555555555",
  street: "Av. Insurgentes Sur 1234",
  neighborhood: "Del Valle",
  city: "Ciudad de México",
  state: "Ciudad de México",
  postalCode: "03100",
  country: "MX",
};

const API_BASE_URL = `http://localhost:${env.port}/api/v1`;
const WEBHOOK_WAIT_TIMEOUT_MS = 20_000;
const WEBHOOK_POLL_INTERVAL_MS = 1_000;
const TWO_WEEKS_DAYS = 14;

// Longer than the normal webhook wait: a real Stripe test-mode dispute (both
// its `.created` and its evidence-driven `.closed`) runs on Stripe's own
// asynchronous schedule, not a synchronous API response.
const DISPUTE_WAIT_TIMEOUT_MS = 5 * 60_000;

const CARRIERS = ["dhl", "fedex", "estafeta", "redpack"] as const;

function fail(message: string): never {
  logger.error(`[seed-batch-orders] ${message}`);
  process.exit(1);
}

function assertPreconditions(): void {
  if (env.isProduction) {
    fail("Refusing to run against NODE_ENV=production — this script moves real (test-mode) money and sends real emails.");
  }
  if (!env.stripeSecretKey.startsWith("sk_test_")) {
    fail("STRIPE_SECRET_KEY must be a test-mode key (sk_test_...). Refusing to touch what might be a live key.");
  }
}

// --- Catalog cleanup (removes the old seed-test-orders.ts junk) ------------

async function cleanupOldTestCatalog(): Promise<void> {
  const oldBike = await Bike.findOneAndDelete({ slug: "bw-test-ride" }).exec();
  if (oldBike) {
    await InventoryItem.deleteMany({ itemType: "bike", itemId: oldBike._id }).exec();
    logger.info(`[seed-batch-orders] Removed old test bike "${oldBike.name}" and its inventory rows.`);
  }
  const oldBrand = await Brand.findOneAndDelete({ slug: "bw-test-brand" }).exec();
  if (oldBrand) logger.info(`[seed-batch-orders] Removed old test brand "${oldBrand.name}".`);
  const oldCategory = await BikeCategory.findOneAndDelete({ slug: "bicicletas-de-prueba" }).exec();
  if (oldCategory) logger.info(`[seed-batch-orders] Removed old test category "${oldCategory.name}".`);
}

// --- Catalog seeding (2 believable products, reusing real categories) ------

interface CatalogRefs {
  bikeId: string;
  accessoryId: string;
}

async function upsertCatalog(): Promise<CatalogRefs> {
  const brand = await Brand.findOneAndUpdate(
    { name: TEST_BRAND_NAME },
    { $setOnInsert: { name: TEST_BRAND_NAME, slug: slugify(TEST_BRAND_NAME) } },
    { upsert: true, new: true },
  ).exec();

  const bikeCategory = await BikeCategory.findOne({}).sort({ createdAt: 1 }).exec();
  if (!bikeCategory) fail("No existing BikeCategory found — the real catalog needs at least one before this script can run.");

  const accessoryCategory = await AccessoryCategory.findOne({}).sort({ createdAt: 1 }).exec();
  if (!accessoryCategory) {
    fail("No existing AccessoryCategory found — the real catalog needs at least one before this script can run.");
  }

  let bike = await Bike.findOne({ slug: slugify(BIKE_NAME) }).exec();
  if (!bike) {
    bike = await Bike.create({
      name: BIKE_NAME,
      slug: slugify(BIKE_NAME),
      brand: brand._id,
      category: bikeCategory._id,
      shortDescription: "Bicicleta de ruta endurance, geometría cómoda para distancias largas.",
      description:
        "La Domane SL6 combina el sistema de amortiguación IsoSpeed con un cuadro de carbono 500 Series " +
        "para absorber el camino sin sacrificar rigidez en el pedaleo. Pensada para quien rueda largo y " +
        "quiere llegar fresco.",
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
    logger.info(`[seed-batch-orders] Created bike "${BIKE_NAME}".`);
  }

  let accessory = await Accessory.findOne({ slug: slugify(ACCESSORY_NAME) }).exec();
  if (!accessory) {
    accessory = await Accessory.create({
      name: ACCESSORY_NAME,
      slug: slugify(ACCESSORY_NAME),
      brand: brand._id,
      category: accessoryCategory._id,
      description: "Casco de ruta ligero con sistema de ajuste giratorio y ventilación MIPS.",
      price: ACCESSORY_PRICE_CENTS,
      variants: [
        { sku: ACCESSORY_SKU_IN_STOCK, size: "U", color: "Negro", fulfillmentMode: "in_stock", isActive: true },
        { sku: ACCESSORY_SKU_ON_REQUEST, size: "U", color: "Blanco", fulfillmentMode: "on_request", isActive: true },
      ],
      specGroups: [],
      gallery: [],
      isActive: true,
    });
    logger.info(`[seed-batch-orders] Created accessory "${ACCESSORY_NAME}".`);
  }

  await seedOrToppedUpInventory("bike", bike._id.toString(), BIKE_SKU_IN_STOCK, BIKE_STOCK_UNITS);
  await seedOrToppedUpInventory("accessory", accessory._id.toString(), ACCESSORY_SKU_IN_STOCK, ACCESSORY_STOCK_UNITS);

  return { bikeId: bike._id.toString(), accessoryId: accessory._id.toString() };
}

async function seedOrToppedUpInventory(
  itemType: "bike" | "accessory",
  itemId: string,
  sku: string,
  units: number,
): Promise<void> {
  const existing = await InventoryItem.findOne({ itemType, itemId, sku }).exec();
  if (!existing) {
    await InventoryItem.create({ itemType, itemId, sku, onHand: units });
  } else if (existing.onHand - existing.reserved < units) {
    await InventoryItem.updateOne({ _id: existing._id }, { $set: { onHand: existing.reserved + units } }).exec();
  }
}

async function upsertTestCustomer(): Promise<void> {
  const existing = await User.findOne({ email: TEST_CUSTOMER_EMAIL }).select("+password");
  if (existing) {
    existing.password = TEST_CUSTOMER_PASSWORD;
    existing.emailVerified = true;
    await existing.save();
    return;
  }
  await User.create({
    email: TEST_CUSTOMER_EMAIL,
    password: TEST_CUSTOMER_PASSWORD,
    firstName: "Cliente",
    lastName: "Prueba",
    role: "customer",
    emailVerified: true,
  });
}

/**
 * A single-use customer for one `pending_payment` order — see this file's own
 * header comment ("Why `pending_payment` orders get their own throwaway
 * customer") for why this cannot share `TEST_CUSTOMER_EMAIL`.
 */
async function pendingCustomerSession(index: number): Promise<ApiSession> {
  const email = pendingCustomerEmail(index);
  const existing = await User.findOne({ email }).select("+password");
  if (existing) {
    existing.password = PENDING_CUSTOMER_PASSWORD;
    existing.emailVerified = true;
    await existing.save();
  } else {
    await User.create({
      email,
      password: PENDING_CUSTOMER_PASSWORD,
      firstName: "Cliente",
      lastName: `Pendiente ${index}`,
      role: "customer",
      emailVerified: true,
    });
  }

  const session = new ApiSession();
  await session.login(email, PENDING_CUSTOMER_PASSWORD);
  return session;
}

// --- Thin HTTP client (customer half only — see header comment) ------------

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
      headers: {
        "Content-Type": "application/json",
        ...(this.cookieHeader ? { Cookie: this.cookieHeader } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (setCookie.length > 0) {
      this.cookieHeader = setCookie.map((entry) => entry.split(";")[0]).join("; ");
    }
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

async function purchaseOne(
  session: ApiSession,
  itemType: "bike" | "accessory",
  itemId: string,
  sku: string,
): Promise<PublicOrderLite> {
  await session.request("DELETE", "/cart");
  await session.request("PUT", "/cart/shipping-address", TEST_SHIPPING_ADDRESS);
  await session.request("POST", "/cart/lines", { itemType, itemId, sku, qty: 1 });
  const result = await session.request<{ order: PublicOrderLite; clientSecret: string }>("POST", "/orders", {});
  return result.order;
}

/**
 * Polls an order until `extract` returns something defined, or fails loudly
 * past `timeoutMs`. `waitForStatus` and the dispute waits below are both this
 * one loop — a `status` change and a `disputeStatus` change are the same kind
 * of fact as far as this script is concerned: something the webhook chain,
 * not the script, is responsible for producing.
 */
async function waitFor<T>(
  orderId: string,
  extract: (order: IOrder) => T | undefined,
  description: string,
  timeoutMs: number = WEBHOOK_WAIT_TIMEOUT_MS,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await Order.findById(orderId).exec();
    if (current) {
      const value = extract(current);
      if (value !== undefined) return value;
    }
    await new Promise((resolve) => setTimeout(resolve, WEBHOOK_POLL_INTERVAL_MS));
  }
  fail(
    `Timed out waiting for order ${orderId} to reach "${description}". ` +
      "Is `stripe listen` running, and is STRIPE_WEBHOOK_SECRET current?",
  );
}

async function waitForStatus(orderId: string, targets: readonly string[]): Promise<string> {
  return waitFor(
    orderId,
    (order) => (targets.includes(order.status) ? order.status : undefined),
    `status en [${targets.join(", ")}]`,
  );
}

/**
 * `paymentMethod` defaults to a normal test card; the two dispute specs pass
 * `pm_card_createDispute` instead — same confirm call, different Stripe magic
 * test payment method, so the rest of the checkout path is unchanged.
 */
async function confirmPayment(stripe: Stripe, orderId: string, paymentMethod = "pm_card_visa"): Promise<string> {
  const order = await Order.findById(orderId).exec();
  if (!order?.payment.intentId) fail(`Order ${orderId} has no payment intent to confirm.`);
  await stripe.paymentIntents.confirm(order.payment.intentId, {
    payment_method: paymentMethod,
    return_url: `${env.clientUrl}/checkout/return`,
  });
  return waitForStatus(orderId, ["paid", "awaiting_supplier_confirmation"]);
}

/**
 * Drives one `charge.dispute.*` chain to its end, against real Stripe test
 * disputes — no fixture, no simulated webhook.
 *
 * 1. `pm_card_createDispute` (already confirmed by the caller) makes Stripe
 *    open a real dispute shortly after the charge succeeds — `.created`
 *    arrives on its own schedule, hence the generous timeout below.
 * 2. Locates that dispute by `payment_intent` rather than trusting a webhook
 *    payload the script never received (it isn't the server).
 * 3. **Won**: submits the `winning_evidence` magic string Stripe's test mode
 *    resolves in the shop's favor. **Lost**: `disputes.close` — Stripe's own
 *    "accept the dispute" action, which always resolves as lost and needs no
 *    evidence-review simulation delay.
 */
async function resolveDispute(stripe: Stripe, orderId: string, outcome: "dispute_won" | "dispute_lost"): Promise<DisputeStatus> {
  logger.info(`[seed-batch-orders]   Esperando a que Stripe abra el contracargo (puede tardar unos minutos)...`);
  await waitFor(
    orderId,
    (order) => order.disputeStatus,
    "disputeStatus abierto (charge.dispute.created)",
    DISPUTE_WAIT_TIMEOUT_MS,
  );

  const order = await Order.findById(orderId).exec();
  if (!order?.payment.intentId) fail(`Order ${orderId} has no payment intent to look up its dispute.`);

  const disputes = await stripe.disputes.list({ payment_intent: order.payment.intentId, limit: 1 });
  const dispute = disputes.data[0];
  if (!dispute) fail(`No se encontró una disputa de Stripe para la orden ${orderId} después de que webhookeó como abierta.`);

  if (outcome === "dispute_won") {
    await stripe.disputes.update(dispute.id, {
      evidence: { uncategorized_text: "winning_evidence" },
      submit: true,
    });
  } else {
    await stripe.disputes.close(dispute.id);
  }

  logger.info(`[seed-batch-orders]   Esperando el desenlace del contracargo (puede tardar unos minutos)...`);
  return waitFor(
    orderId,
    (order) => (order.disputeStatus && order.disputeStatus !== "open" ? order.disputeStatus : undefined),
    `disputeStatus resuelto (${outcome === "dispute_won" ? "won" : "lost"})`,
    DISPUTE_WAIT_TIMEOUT_MS,
  );
}

// --- The 20-order plan -------------------------------------------------

type TargetStatus =
  | "pending_payment"
  | "awaiting_supplier_confirmation"
  | "authorization_expired"
  | "cancelled"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "refunded"
  | "dispute_won"
  | "dispute_lost";

/**
 * What `order.status` must be, once the webhook chain settles, for each
 * target above. Both dispute targets stay `paid` — a chargeback moves money
 * through Stripe's own process, not through `markRefunded`, so `status`
 * never becomes `refunded` for either outcome. Used only by the closing
 * verification, never during the run itself.
 */
const EXPECTED_ORDER_STATUS: Record<TargetStatus, OrderStatus> = {
  pending_payment: "pending_payment",
  awaiting_supplier_confirmation: "awaiting_supplier_confirmation",
  authorization_expired: "authorization_expired",
  cancelled: "cancelled",
  paid: "paid",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  refunded: "refunded",
  dispute_won: "paid",
  dispute_lost: "paid",
};

/** Only the two dispute targets have an expected `disputeStatus` — everything else is left unchecked. */
const EXPECTED_DISPUTE_STATUS: Partial<Record<TargetStatus, DisputeStatus>> = {
  dispute_won: "won",
  dispute_lost: "lost",
};

interface OrderSpec {
  product: "bike" | "accessory";
  mode: "in_stock" | "on_request";
  targetStatus: TargetStatus;
}

/**
 * 22 entries, 9 reachable `OrderStatus` values plus both dispute outcomes
 * (`authorized` is transient by design — see the module header). Split
 * roughly half `in_stock` / half `on_request` so both capture paths — and
 * both notification shapes — get exercised. Both dispute specs are
 * `in_stock`: a chargeback is a card-network dispute over money already
 * taken, which only automatic capture produces immediately.
 */
function buildOrderPlan(): OrderSpec[] {
  const plan: OrderSpec[] = [
    { product: "bike", mode: "in_stock", targetStatus: "pending_payment" },
    { product: "accessory", mode: "in_stock", targetStatus: "pending_payment" },

    { product: "bike", mode: "on_request", targetStatus: "awaiting_supplier_confirmation" },
    { product: "accessory", mode: "on_request", targetStatus: "awaiting_supplier_confirmation" },

    { product: "bike", mode: "on_request", targetStatus: "authorization_expired" },

    { product: "bike", mode: "on_request", targetStatus: "cancelled" },
    { product: "accessory", mode: "on_request", targetStatus: "cancelled" },

    { product: "bike", mode: "in_stock", targetStatus: "paid" },
    { product: "accessory", mode: "in_stock", targetStatus: "paid" },
    { product: "bike", mode: "on_request", targetStatus: "paid" },

    { product: "accessory", mode: "in_stock", targetStatus: "processing" },
    { product: "bike", mode: "in_stock", targetStatus: "processing" },
    { product: "accessory", mode: "on_request", targetStatus: "processing" },

    { product: "bike", mode: "in_stock", targetStatus: "shipped" },
    { product: "accessory", mode: "in_stock", targetStatus: "shipped" },
    { product: "bike", mode: "on_request", targetStatus: "shipped" },

    { product: "accessory", mode: "in_stock", targetStatus: "delivered" },
    { product: "bike", mode: "on_request", targetStatus: "delivered" },

    { product: "bike", mode: "in_stock", targetStatus: "refunded" },
    { product: "accessory", mode: "on_request", targetStatus: "refunded" },

    { product: "accessory", mode: "in_stock", targetStatus: "dispute_won" },
    { product: "bike", mode: "in_stock", targetStatus: "dispute_lost" },
  ];
  return plan;
}

function skuFor(catalog: CatalogRefs, spec: OrderSpec): { itemId: string; sku: string } {
  if (spec.product === "bike") {
    return { itemId: catalog.bikeId, sku: spec.mode === "in_stock" ? BIKE_SKU_IN_STOCK : BIKE_SKU_ON_REQUEST };
  }
  return { itemId: catalog.accessoryId, sku: spec.mode === "in_stock" ? ACCESSORY_SKU_IN_STOCK : ACCESSORY_SKU_ON_REQUEST };
}

function pickCarrier(index: number): (typeof CARRIERS)[number] {
  return CARRIERS[index % CARRIERS.length]!;
}

/** 20 dates spread across the last two weeks, jittered within the day so the chart doesn't look gridded. */
function buildTwoWeekDateSpread(count: number): Date[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor((i / count) * TWO_WEEKS_DAYS) + 1; // 1..14 days ago, spread evenly
    const jitterMs = Math.floor(Math.random() * dayMs * 0.8);
    dates.push(new Date(now - dayOffset * dayMs - jitterMs));
  }
  // Shuffle so status/date aren't correlated (deterministic-ish, fine for a seed script).
  for (let i = dates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dates[i], dates[j]] = [dates[j]!, dates[i]!];
  }
  return dates;
}

// --- Main -------------------------------------------------------------

async function run(): Promise<void> {
  assertPreconditions();
  await connectDb();

  try {
    const settings = await settingsService.get();
    if (settings.orders.requestThreeDSecure === "any") {
      fail('settings.orders.requestThreeDSecure is "any" — set it to "automatic" from /admin/configuracion before running this script.');
    }
    if (!env.isStripeConfigured) fail("STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set.");
    if (!env.isResendConfigured) fail("RESEND_API_KEY / MAIL_FROM are not set — this script exists partly to test real email delivery.");
    if (!env.isTelegramConfigured) fail("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set.");

    await cleanupOldTestCatalog();
    const catalog = await upsertCatalog();
    await upsertTestCustomer();

    // Not exposed on `env.ts` — `SEED_ADMIN_EMAIL` is only ever read directly
    // from `process.env`, same as `seed-admin.ts` itself does.
    const adminActorUser = await User.findOne({ role: { $in: ["admin", "superadmin"] } }).sort({ createdAt: 1 }).exec();
    const actor: ActorContext = { actorId: adminActorUser ? adminActorUser._id.toString() : "system-seed-batch-orders" };

    const stripe = new Stripe(env.stripeSecretKey, { apiVersion: Stripe.API_VERSION, typescript: true });
    const session = new ApiSession();
    await session.login(TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD);

    const plan = buildOrderPlan();
    const results: { id: string; orderNumber: string; targetStatus: TargetStatus; finalStatus: string }[] = [];
    let pendingCustomerIndex = 0;

    for (let i = 0; i < plan.length; i++) {
      const spec = plan[i]!;
      const { itemId, sku } = skuFor(catalog, spec);
      logger.info(`[seed-batch-orders] (${i + 1}/${plan.length}) ${spec.product}/${spec.mode} → objetivo: ${spec.targetStatus}`);

      // `pending_payment` needs a customer that never checks out a second
      // time — see this file's own header comment for why the shared
      // `session` below would cancel it on the very next purchase.
      if (spec.targetStatus === "pending_payment") {
        pendingCustomerIndex++;
        const pendingSession = await pendingCustomerSession(pendingCustomerIndex);
        const order = await purchaseOne(pendingSession, spec.product, itemId, sku);
        results.push({ ...order, targetStatus: spec.targetStatus, finalStatus: "pending_payment" });
        continue;
      }

      const order = await purchaseOne(session, spec.product, itemId, sku);

      const isDispute = spec.targetStatus === "dispute_won" || spec.targetStatus === "dispute_lost";
      let status = await confirmPayment(stripe, order.id, isDispute ? "pm_card_createDispute" : "pm_card_visa");

      if (spec.targetStatus === "dispute_won" || spec.targetStatus === "dispute_lost") {
        // Both dispute specs are `in_stock` (automatic capture), so `status`
        // above is already `paid` — see `buildOrderPlan`'s own comment.
        const disputeStatus = await resolveDispute(stripe, order.id, spec.targetStatus);
        results.push({ ...order, targetStatus: spec.targetStatus, finalStatus: `paid, disputeStatus: ${disputeStatus}` });
        continue;
      }

      if (spec.targetStatus === "awaiting_supplier_confirmation" || spec.targetStatus === "authorization_expired") {
        results.push({ ...order, targetStatus: spec.targetStatus, finalStatus: status });
        continue;
      }

      if (spec.targetStatus === "cancelled") {
        await orderService.rejectSupplierStock(order.id, "Sin stock disponible con el proveedor.", actor);
        results.push({ ...order, targetStatus: spec.targetStatus, finalStatus: "cancelled" });
        continue;
      }

      // Everything past here needs to be `paid` first.
      if (status === "awaiting_supplier_confirmation") {
        await orderService.confirmSupplierStock(order.id, actor);
        status = "paid";
      }

      if (spec.targetStatus === "paid") {
        results.push({ ...order, targetStatus: spec.targetStatus, finalStatus: status });
        continue;
      }

      await orderService.bulkUpdateStatus([order.id], "processing", undefined, actor);
      if (spec.targetStatus === "processing") {
        results.push({ ...order, targetStatus: spec.targetStatus, finalStatus: "processing" });
        continue;
      }

      await orderService.recordShipment(
        order.id,
        { carrier: pickCarrier(i), trackingNumber: `SEED${String(i).padStart(6, "0")}` },
        actor,
      );
      if (spec.targetStatus === "shipped") {
        results.push({ ...order, targetStatus: spec.targetStatus, finalStatus: "shipped" });
        continue;
      }

      // delivered and refunded both pass through delivered.
      await orderService.bulkUpdateStatus([order.id], "delivered", undefined, actor);
      if (spec.targetStatus === "delivered") {
        results.push({ ...order, targetStatus: spec.targetStatus, finalStatus: "delivered" });
        continue;
      }

      const paidOrder = await Order.findById(order.id).exec();
      if (!paidOrder?.payment.intentId) fail(`Order ${order.id} has no payment intent to refund.`);
      await stripe.refunds.create({ payment_intent: paidOrder.payment.intentId });
      const finalStatus = await waitForStatus(order.id, ["refunded"]);
      results.push({ ...order, targetStatus: spec.targetStatus, finalStatus });
    }

    // Real expiry sweep — only the orders deliberately backdated far enough
    // past `orderAuthCancelHours` are due, so this won't touch the
    // `awaiting_supplier_confirmation` orders meant to stay there.
    const expiring = results.filter((r) => r.targetStatus === "authorization_expired");
    if (expiring.length > 0) {
      const pastDue = new Date(Date.now() - (settings.orders.orderAuthCancelHours + 24) * 60 * 60 * 1000);
      for (const r of expiring) {
        await Order.updateOne({ _id: r.id }, { $set: { "payment.authorizedAt": pastDue } }).exec();
      }
      const swept = await orderMaintenanceService.cancelExpiredAuthorizations(new Date(), settings.orders.orderAuthCancelHours);
      logger.info(`[seed-batch-orders] Expiry sweep cancelled ${swept} order(s).`);
    }

    // Backdate every order's createdAt/updatedAt across the last two weeks —
    // the only field the stats module actually reads for windowing.
    // `pending_payment` orders are excluded — see this file's own header
    // comment for why backdating them would sit them somewhere the
    // reconciliation job could never have actually left them.
    const backdatable = results.filter((r) => r.targetStatus !== "pending_payment");
    const dates = buildTwoWeekDateSpread(backdatable.length);
    for (let i = 0; i < backdatable.length; i++) {
      await Order.updateOne(
        { _id: backdatable[i]!.id },
        { $set: { createdAt: dates[i], updatedAt: dates[i] } },
        { overwriteImmutable: true, timestamps: false },
      ).exec();
    }

    // Verification, not narration: re-fetch every order fresh from Mongo and
    // compare what actually got persisted against what the plan asked for.
    // See this file's own header comment for why this doesn't just trust the
    // `results` array built while driving the run above.
    logger.info("");
    logger.info(`[seed-batch-orders] Verificando ${results.length} órdenes contra Mongo...`);
    let mismatches = 0;
    const verifiedLines: string[] = [];
    for (const r of results) {
      const fresh = await Order.findById(r.id).exec();
      const actualStatus = fresh?.status;
      const expectedStatus = EXPECTED_ORDER_STATUS[r.targetStatus];
      const expectedDispute = EXPECTED_DISPUTE_STATUS[r.targetStatus];
      const actualDispute = fresh?.disputeStatus;
      const ok = Boolean(fresh) && actualStatus === expectedStatus && (expectedDispute === undefined || actualDispute === expectedDispute);
      if (!ok) mismatches++;
      const disputeNote = expectedDispute !== undefined ? ` · disputeStatus real: ${actualDispute ?? "(ninguno)"}` : "";
      verifiedLines.push(
        `  ${ok ? "OK      " : "MISMATCH"} ${r.orderNumber} — objetivo: ${r.targetStatus} — status real: ${actualStatus ?? "(orden no encontrada)"}${disputeNote}`,
      );
    }

    logger.info("");
    logger.info(`[seed-batch-orders] Listo. ${results.length} órdenes en /admin/ordenes:`);
    for (const line of verifiedLines) logger.info(line);
    logger.info("");
    logger.info(`  Notificaciones de cliente enviadas a: ${TEST_CUSTOMER_EMAIL}`);
    logger.info(`  Cliente de prueba (login storefront): ${TEST_CUSTOMER_EMAIL} / ${TEST_CUSTOMER_PASSWORD}`);

    if (mismatches > 0) {
      fail(`${mismatches} orden(es) no llegaron al estado esperado — ver "MISMATCH" arriba.`);
    }
  } finally {
    await disconnectDb();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, "[seed-batch-orders] Failed.");
  process.exit(1);
});
