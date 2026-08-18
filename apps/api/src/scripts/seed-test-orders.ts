import Stripe from "stripe";
import { connectDb, disconnectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Bike, BikeCategory, Brand, InventoryItem, Order, User } from "../models/index.js";
import { settingsService } from "../services/settings.service.js";
import { slugify } from "../utils/index.js";

/**
 * Seeds two real, end-to-end orders in the local database — one `in_stock`
 * (fully captured, `paid`) and one `on_request` (manual capture, sitting in
 * `awaiting_supplier_confirmation`) — so the two flows described in
 * docs/MILESTONES.md can be walked by hand from `/admin/ordenes` without
 * building a storefront first.
 *
 * Permanent replacement for the scratchpad-only `verify-m9-stripe.ts` from
 * M9 (see docs/MILESTONES.md, "M9 — Órdenes y cola de confirmación de
 * proveedor"), which never survived between sessions. This one lives in the
 * repo and is meant to be re-run every time fresh test orders are needed —
 * including while building the order-notification emails next.
 *
 *   pnpm --filter @bw-bikes/api seed:test-orders
 *
 * ## Before running
 *
 * 1. This machine's current public IP must be allow-listed in Atlas →
 *    Network Access, or `connectDb()` hangs. Known recurring issue on this
 *    project — see docs/MILESTONES.md, M9's closing notes.
 * 2. In a separate terminal:
 *      stripe listen --api-key "$STRIPE_SECRET_KEY" \
 *        --forward-to localhost:4000/api/v1/webhooks/stripe
 *    The `--api-key` flag is not optional — the Stripe CLI has its own
 *    logged-in account, and without it events tunnel from the wrong
 *    account and nothing arrives, silently.
 * 3. Copy the `whsec_...` that command prints into
 *    `STRIPE_WEBHOOK_SECRET` in `.env.development.local` and **restart**
 *    the API — that value changes on every `stripe listen` run.
 * 4. `pnpm dev:api` running (this script talks to it over HTTP for the
 *    parts a browser would normally do — cart, checkout, payment
 *    confirmation).
 *
 * ## Why part of this goes over HTTP instead of calling services directly
 *
 * Checkout is a saga with real side effects (inventory holds, a Stripe
 * PaymentIntent, an idempotency key) and the only thing that closes the
 * loop and produces a genuine webhook delivery is the running server. The
 * catalog and the test customer, by contrast, are just data — those are
 * written straight through Mongoose, the same way `seed-admin.ts` does it,
 * because the real path (the admin CRUD) requires a TOTP-enrolled session
 * a script cannot complete.
 */

const TEST_BRAND_NAME = "BW Test Brand";
const TEST_CATEGORY_NAME = "Bicicletas de prueba";
const TEST_BIKE_NAME = "BW Test Ride";
const SKU_IN_STOCK = "BW-TEST-INSTOCK";
const SKU_ON_REQUEST = "BW-TEST-ONREQUEST";
const TEST_BIKE_PRICE_CENTS = 4_500_000; // $45,000.00 MXN — clears the free-shipping threshold either way.
const STOCK_UNITS = 5;

// A `.local` domain fails Joi's `.email()` TLD check (used by `/auth/login`'s
// validator) — needs a domain with a real TLD, even though this account never
// receives mail.
const TEST_CUSTOMER_EMAIL = "cliente.prueba@bwbikes-test.com";
const TEST_CUSTOMER_PASSWORD = "PruebaBW2026!";

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

function fail(message: string): never {
  logger.error(`[seed-test-orders] ${message}`);
  process.exit(1);
}

function assertPreconditions(): void {
  if (env.isProduction) {
    fail("Refusing to run against NODE_ENV=production — this script moves real money if Stripe is live.");
  }
  if (!env.stripeSecretKey.startsWith("sk_test_")) {
    fail(
      "STRIPE_SECRET_KEY must be a test-mode key (sk_test_...) to run this script. " +
        "Refusing to touch what might be a live key.",
    );
  }
}

async function upsertCatalog(): Promise<{ bikeId: string; skuInStock: string; skuOnRequest: string }> {
  const brand = await Brand.findOneAndUpdate(
    { name: TEST_BRAND_NAME },
    { $setOnInsert: { name: TEST_BRAND_NAME, slug: slugify(TEST_BRAND_NAME) } },
    { upsert: true, new: true },
  ).exec();

  const category = await BikeCategory.findOneAndUpdate(
    { name: TEST_CATEGORY_NAME },
    { $setOnInsert: { name: TEST_CATEGORY_NAME, slug: slugify(TEST_CATEGORY_NAME), parent: null } },
    { upsert: true, new: true },
  ).exec();

  let bike = await Bike.findOne({ slug: slugify(TEST_BIKE_NAME) }).exec();

  if (!bike) {
    bike = await Bike.create({
      name: TEST_BIKE_NAME,
      slug: slugify(TEST_BIKE_NAME),
      brand: brand._id,
      category: category._id,
      shortDescription: "Bicicleta de prueba para ejercitar el flujo de órdenes end-to-end.",
      description:
        "Producto sembrado por seed-test-orders.ts. No es un producto real del catálogo — " +
        "existe únicamente para poder recorrer el flujo de compra en stock y bajo pedido en local.",
      price: TEST_BIKE_PRICE_CENTS,
      variants: [
        { sku: SKU_IN_STOCK, size: "M", color: "Negro", fulfillmentMode: "in_stock", isActive: true },
        { sku: SKU_ON_REQUEST, size: "L", color: "Blanco", fulfillmentMode: "on_request", isActive: true },
      ],
      gallery: [],
      isActive: true,
    });
    logger.info(`[seed-test-orders] Created test bike "${TEST_BIKE_NAME}" with variants ${SKU_IN_STOCK} / ${SKU_ON_REQUEST}.`);
  } else {
    logger.info(`[seed-test-orders] Test bike "${TEST_BIKE_NAME}" already exists — reusing it.`);
  }

  // Only the `in_stock` SKU gets an `InventoryItem` — `on_request` lines never
  // hold physical stock (`inventory.service.ts`'s `reserve`). Written and
  // topped up directly rather than through `seedInitialStock`, which only
  // knows how to create — a second run against an already-purchased-down
  // stock level needs to replenish, not skip.
  const inventoryItem = await InventoryItem.findOne({ itemType: "bike", itemId: bike._id, sku: SKU_IN_STOCK }).exec();
  if (!inventoryItem) {
    await InventoryItem.create({ itemType: "bike", itemId: bike._id, sku: SKU_IN_STOCK, onHand: STOCK_UNITS });
    logger.info(`[seed-test-orders] Seeded initial stock for ${SKU_IN_STOCK} (${STOCK_UNITS} units).`);
  } else if (inventoryItem.onHand - inventoryItem.reserved < 1) {
    await InventoryItem.updateOne(
      { _id: inventoryItem._id },
      { $set: { onHand: inventoryItem.reserved + STOCK_UNITS } },
    ).exec();
    logger.info(`[seed-test-orders] Topped up stock for ${SKU_IN_STOCK} (+${STOCK_UNITS} units).`);
  }

  return { bikeId: bike._id.toString(), skuInStock: SKU_IN_STOCK, skuOnRequest: SKU_ON_REQUEST };
}

async function upsertTestCustomer(): Promise<void> {
  const existing = await User.findOne({ email: TEST_CUSTOMER_EMAIL }).select("+password");
  if (existing) {
    existing.password = TEST_CUSTOMER_PASSWORD;
    existing.emailVerified = true;
    await existing.save();
    logger.info(`[seed-test-orders] Updated existing test customer: ${TEST_CUSTOMER_EMAIL}`);
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
  logger.info(`[seed-test-orders] Created test customer: ${TEST_CUSTOMER_EMAIL}`);
}

interface ApiEnvelope<T> {
  status: "success" | "fail";
  message: string;
  data?: T;
}

/** Thin HTTP client that carries the session cookie across calls, mirroring what a browser does automatically. */
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

async function purchaseOne(session: ApiSession, bikeId: string, sku: string): Promise<PublicOrderLite> {
  await session.request("DELETE", "/cart");
  await session.request("PUT", "/cart/shipping-address", TEST_SHIPPING_ADDRESS);
  await session.request("POST", "/cart/lines", { itemType: "bike", itemId: bikeId, sku, qty: 1 });

  const result = await session.request<{ order: PublicOrderLite; clientSecret: string }>("POST", "/orders", {});
  return result.order;
}

async function confirmPaymentAndWaitForWebhook(stripe: Stripe, orderId: string): Promise<string> {
  const order = await Order.findById(orderId).exec();
  if (!order?.payment.intentId) {
    fail(`Order ${orderId} has no payment intent to confirm.`);
  }

  await stripe.paymentIntents.confirm(order.payment.intentId, {
    payment_method: "pm_card_visa",
    return_url: `${env.clientUrl}/checkout/return`,
  });

  const deadline = Date.now() + WEBHOOK_WAIT_TIMEOUT_MS;
  let lastStatus = order.status;
  while (Date.now() < deadline) {
    const current = await Order.findById(orderId).exec();
    if (!current) break;
    lastStatus = current.status;
    if (lastStatus === "paid" || lastStatus === "awaiting_supplier_confirmation") {
      return lastStatus;
    }
    await new Promise((resolve) => setTimeout(resolve, WEBHOOK_POLL_INTERVAL_MS));
  }

  fail(
    `Timed out waiting for the Stripe webhook on order ${orderId} (still "${lastStatus}"). ` +
      "Is `stripe listen` running, and is STRIPE_WEBHOOK_SECRET current for this session?",
  );
}

async function run(): Promise<void> {
  assertPreconditions();

  await connectDb();
  try {
    const settings = await settingsService.get();
    if (settings.orders.requestThreeDSecure === "any") {
      fail(
        'settings.orders.requestThreeDSecure is "any" — pm_card_visa cannot complete a 3DS challenge ' +
          'without a browser. Set it to "automatic" from /admin/configuracion before running this script.',
      );
    }

    if (!env.isStripeConfigured) {
      fail("STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set — payments are not configured.");
    }

    const { bikeId, skuInStock, skuOnRequest } = await upsertCatalog();
    await upsertTestCustomer();

    const stripe = new Stripe(env.stripeSecretKey, { apiVersion: Stripe.API_VERSION, typescript: true });
    const session = new ApiSession();
    await session.login(TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD);

    logger.info("[seed-test-orders] Placing order A (in stock)...");
    const orderA = await purchaseOne(session, bikeId, skuInStock);
    const statusA = await confirmPaymentAndWaitForWebhook(stripe, orderA.id);

    logger.info("[seed-test-orders] Placing order B (on request)...");
    const orderB = await purchaseOne(session, bikeId, skuOnRequest);
    const statusB = await confirmPaymentAndWaitForWebhook(stripe, orderB.id);

    logger.info("");
    logger.info("[seed-test-orders] Done. Two orders ready in /admin/ordenes:");
    logger.info(`  Orden A — ${orderA.orderNumber} — estatus: ${statusA}`);
    logger.info(
      statusA === "paid"
        ? '    Siguiente paso: pestaña "Todas" → "Marcar en preparación" → capturar guía → "Marcar entregada".'
        : `    Estatus inesperado — se esperaba "paid".`,
    );
    logger.info(`  Orden B — ${orderB.orderNumber} — estatus: ${statusB}`);
    logger.info(
      statusB === "awaiting_supplier_confirmation"
        ? '    Siguiente paso: pestaña "Cola de proveedor" → "Confirmar" (captura el cargo real) → ' +
            '"Marcar en preparación" → capturar guía → "Marcar entregada".'
        : `    Estatus inesperado — se esperaba "awaiting_supplier_confirmation".`,
    );
    logger.info("");
    logger.info(`  Cliente de prueba: ${TEST_CUSTOMER_EMAIL} / ${TEST_CUSTOMER_PASSWORD}`);
  } finally {
    await disconnectDb();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, "[seed-test-orders] Failed.");
  process.exit(1);
});
