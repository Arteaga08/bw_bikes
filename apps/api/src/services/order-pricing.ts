import type {
  CaptureMethod,
  CartLineInput,
  FulfillmentMode,
  ItemType,
  OrderLineSnapshot,
  OrderTotals,
  ProductVariant,
} from "@bw-bikes/shared";
import { CURRENCY } from "@bw-bikes/shared";
import { Types } from "mongoose";
import { env } from "../config/env.js";
import type { IAccessory, IBike } from "../models/index.js";
import { Accessory, Bike, MAX_RESERVATION_QTY } from "../models/index.js";
import { AppError } from "../utils/index.js";

/**
 * Pricing and line resolution for the checkout.
 *
 * Deliberately separate from `order.service.ts`: this is where the money is
 * decided, and it holds no payment provider, no order document and no session.
 * That is what lets `tests/order-totals.test.ts` pin the arithmetic down
 * without a Stripe key in sight.
 *
 * ## The rule this file exists to enforce
 *
 * **The server calculates the amount. The client's payload never does.**
 * Nothing here reads a price, a total, or a currency from a request body —
 * only `{ itemType, itemId, sku, qty }`, which say *what* is being bought, not
 * *for how much*. Everything else is re-read from the catalog at this moment.
 */

/** Shipping is a flat zero until M6 closes the shipping-cost decision. */
const SHIPPING_CENTS = 0;

/** Products with no image: the snapshot simply carries none, never a broken reference. */
const NO_IMAGE = undefined;

type CatalogProduct = IBike | IAccessory;

interface ResolvedLine {
  snapshot: OrderLineSnapshot;
  /** Kept out of the snapshot: a slug is a link, and links change without changing what was bought. */
  slug: string;
}

/**
 * The outcome of pricing one cart line, as data rather than an exception.
 *
 * The cart needs to *show* a line that can no longer be bought, greyed out and
 * explained; the checkout needs to *refuse* it. Both need the exact same
 * catalog lookup, so the lookup returns a verdict and each caller decides what
 * to do with it — otherwise the cart would have to catch exceptions to render
 * itself, or the two paths would drift apart.
 */
type LineResolution =
  | { ok: true; sku: string; line: ResolvedLine }
  | { ok: false; sku: string; itemType: ItemType; itemId: string; qty: number; reason: string };

function toObjectId(value: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

/** The primary image is the one with the lowest `order`, not the first stored. */
function primaryImagePublicId(product: CatalogProduct): string | undefined {
  const sorted = [...product.gallery].sort((a, b) => a.order - b.order);
  return sorted[0]?.publicId ?? NO_IMAGE;
}

/**
 * A variant may override the product price (an XL frame, a limited-edition
 * colour). `?? ` and not `||`: an override of 0 is a real price, and `||` would
 * silently discard it.
 */
function effectivePriceCents(product: CatalogProduct, variant: ProductVariant): number {
  return variant.price ?? product.price;
}

/**
 * Loads every product referenced by the cart in **two queries at most** — one
 * per catalog — instead of one per line. A ten-line cart is not a reason for
 * ten round trips, and the two catalogs are separate collections, which is why
 * it is two and not one.
 */
async function loadProducts(lines: CartLineInput[]): Promise<Map<string, CatalogProduct>> {
  const bikeIds: Types.ObjectId[] = [];
  const accessoryIds: Types.ObjectId[] = [];

  for (const line of lines) {
    const id = toObjectId(line.itemId);
    if (!id) continue;
    if (line.itemType === "bike") bikeIds.push(id);
    else accessoryIds.push(id);
  }

  const [bikes, accessories] = await Promise.all([
    bikeIds.length > 0 ? Bike.find({ _id: { $in: bikeIds } }).exec() : Promise.resolve([]),
    accessoryIds.length > 0 ? Accessory.find({ _id: { $in: accessoryIds } }).exec() : Promise.resolve([]),
  ]);

  const byKey = new Map<string, CatalogProduct>();
  for (const bike of bikes) byKey.set(`bike:${String(bike._id)}`, bike);
  for (const accessory of accessories) byKey.set(`accessory:${String(accessory._id)}`, accessory);
  return byKey;
}

function assertQty(qty: number, sku: string): void {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_RESERVATION_QTY) {
    throw new AppError(`La cantidad solicitada para el SKU ${sku} no es válida.`, 400);
  }
}

function unavailable(line: CartLineInput, reason: string): LineResolution {
  return { ok: false, sku: line.sku, itemType: line.itemType, itemId: line.itemId, qty: line.qty, reason };
}

/**
 * Prices every cart line against the live catalog.
 *
 * The order of the results mirrors the order of the input, so a caller can zip
 * them back onto its own lines without matching by key.
 */
async function resolveCartLines(lines: CartLineInput[]): Promise<LineResolution[]> {
  const products = await loadProducts(lines);

  return lines.map((line) => {
    assertQty(line.qty, line.sku);

    const product = products.get(`${line.itemType}:${line.itemId}`);

    // One message for "archived", "never existed" and "bad id" on purpose: the
    // customer can act on none of the three differently, and distinguishing
    // them would turn the cart into a probe for which product ids exist.
    if (!product || !product.isActive) {
      return unavailable(line, "Este producto ya no está disponible.");
    }

    const variant = product.variants.find((candidate) => candidate.sku === line.sku);
    if (!variant || !variant.isActive) {
      return unavailable(line, "Esta variante ya no está disponible.");
    }

    const unitPriceCents = effectivePriceCents(product, variant);

    return {
      ok: true,
      sku: line.sku,
      line: {
        slug: product.slug,
        snapshot: {
          itemType: line.itemType,
          itemId: String(product._id),
          sku: variant.sku,
          name: product.name,
          brand: product.brand,
          ...(variant.size !== undefined ? { size: variant.size } : {}),
          ...(variant.color !== undefined ? { color: variant.color } : {}),
          ...(primaryImagePublicId(product) !== undefined
            ? { imagePublicId: primaryImagePublicId(product)! }
            : {}),
          fulfillmentMode: variant.fulfillmentMode,
          unitPriceCents,
          qty: line.qty,
          lineTotalCents: unitPriceCents * line.qty,
        },
      },
    };
  });
}

/**
 * The checkout's view of the same lookup: all lines must be purchasable or the
 * whole order is refused. Partial checkout is not offered — silently dropping
 * a line the customer chose is worse than telling them what changed.
 */
async function buildLineSnapshots(lines: CartLineInput[]): Promise<OrderLineSnapshot[]> {
  if (lines.length === 0) {
    throw new AppError("Tu carrito está vacío.", 400);
  }

  const resolutions = await resolveCartLines(lines);
  const blocked = resolutions.find((resolution) => !resolution.ok);

  if (blocked && !blocked.ok) {
    throw new AppError(`${blocked.reason} (SKU ${blocked.sku})`, 409);
  }

  return resolutions.map((resolution) => (resolution as Extract<LineResolution, { ok: true }>).line.snapshot);
}

/**
 * **The mixed-cart rule.** One line that isn't `in_stock` makes the entire
 * order manual-capture: the card is authorized now and charged only once the
 * shop confirms it can fulfil. `on_request` and `preorder` are treated
 * identically — neither owns stock today, so neither may be charged today.
 *
 * The alternative, splitting the cart into an immediate charge and a separate
 * authorization, was rejected: it doubles the checkout, doubles the refund
 * surface, and leaves the customer holding half a purchase when one half
 * fails.
 */
function resolveCaptureMethod(lines: { fulfillmentMode: FulfillmentMode }[]): CaptureMethod {
  return lines.every((line) => line.fulfillmentMode === "in_stock") ? "automatic" : "manual";
}

/**
 * Totals in integer cents.
 *
 * `taxCents` is a **breakdown, not an addition**: Mexican B2C prices are quoted
 * IVA-included, so the tax is extracted from the total
 * (`total × bps / (10000 + bps)`) rather than added to it. Charging
 * `subtotal + 16%` here would silently bill every customer 16% above the price
 * they saw on the product page.
 */
function calculateTotals(lines: OrderLineSnapshot[], shippingCents: number = SHIPPING_CENTS): OrderTotals {
  let subtotalCents = 0;

  for (const line of lines) {
    // `lineTotalCents` is the number that ends up being charged, so it is
    // recomputed rather than trusted — a snapshot assembled anywhere but
    // `resolveCartLines` must not be able to carry its own total.
    if (line.lineTotalCents !== line.unitPriceCents * line.qty) {
      throw new AppError(`El total de la línea del SKU ${line.sku} no coincide con su precio unitario.`, 400);
    }
    subtotalCents += line.lineTotalCents;
  }

  const totalCents = subtotalCents + shippingCents;
  const taxCents = Math.round((totalCents * env.taxRateBps) / (10_000 + env.taxRateBps));

  return { subtotalCents, taxCents, shippingCents, totalCents, currency: CURRENCY };
}

export type { LineResolution, ResolvedLine };
export { SHIPPING_CENTS, buildLineSnapshots, calculateTotals, resolveCaptureMethod, resolveCartLines };
