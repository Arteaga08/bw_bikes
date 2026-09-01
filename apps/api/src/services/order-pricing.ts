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
import { DEFAULT_TAX_RATE_BPS } from "../config/settings.defaults.js";
import type { IAccessory, IBike, IBrand } from "../models/index.js";
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
 * `brand` is a reference on the product but a **frozen string** on the order
 * line snapshot — the line has to keep reading correctly even if the brand is
 * later renamed. `loadProducts` always populates it, so the fallback below is
 * defensive, not an expected path.
 */
function brandName(product: CatalogProduct): string {
  return product.populated("brand") ? (product.brand as unknown as IBrand).name : "";
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
 *
 * Also the resolver `account.service.ts` reuses to hydrate the wishlist
 * (A5-guardados.md) against `{ itemType, itemId }` alone — the cart's own
 * `sku`/`qty` on `CartLineInput` are simply unused by that caller. `category`
 * and `badges` are populated too, alongside `brand`: the cart snapshot never
 * reads them, but `toPublicBike`/`toPublicAccessory` need them populated to
 * serialize a full card-displayable product for the wishlist read.
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
    bikeIds.length > 0
      ? Bike.find({ _id: { $in: bikeIds } }).populate("brand").populate("category").populate("badges").exec()
      : Promise.resolve([]),
    accessoryIds.length > 0
      ? Accessory.find({ _id: { $in: accessoryIds } }).populate("brand").populate("category").populate("badges").exec()
      : Promise.resolve([]),
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
          brand: brandName(product),
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
 * Maps each line to the category its product belongs to, keyed
 * `"itemType:itemId"` — the same key `loadProducts` builds.
 *
 * Only called for a coupon scoped to specific categories, which is why it is a
 * separate lookup instead of a field on `OrderLineSnapshot`: a snapshot is
 * frozen at purchase, and a product's category is a *today* fact that the
 * shop reorganises freely. Freezing it would mean a campaign aimed at
 * "Montaña" silently missing bikes that were moved into it last week.
 *
 * Two queries at most, same as `loadProducts`, and `.select("category")`
 * because nothing else is needed.
 */
async function resolveLineCategoryIds(lines: Pick<OrderLineSnapshot, "itemType" | "itemId">[]): Promise<
  Map<string, string>
> {
  const bikeIds: Types.ObjectId[] = [];
  const accessoryIds: Types.ObjectId[] = [];

  for (const line of lines) {
    const id = toObjectId(line.itemId);
    if (!id) continue;
    if (line.itemType === "bike") bikeIds.push(id);
    else accessoryIds.push(id);
  }

  const [bikes, accessories] = await Promise.all([
    bikeIds.length > 0 ? Bike.find({ _id: { $in: bikeIds } }).select("category").lean().exec() : Promise.resolve([]),
    accessoryIds.length > 0
      ? Accessory.find({ _id: { $in: accessoryIds } }).select("category").lean().exec()
      : Promise.resolve([]),
  ]);

  const byKey = new Map<string, string>();
  for (const bike of bikes) byKey.set(`bike:${String(bike._id)}`, String(bike.category));
  for (const accessory of accessories) byKey.set(`accessory:${String(accessory._id)}`, String(accessory.category));
  return byKey;
}

/**
 * Totals in integer cents.
 *
 * `taxCents` is a **breakdown, not an addition**: Mexican B2C prices are quoted
 * IVA-included, so the tax is extracted from the total
 * (`total × bps / (10000 + bps)`) rather than added to it. Charging
 * `subtotal + 16%` here would silently bill every customer 16% above the price
 * they saw on the product page.
 *
 * `shippingCents` is supplied by the caller — `shippingService.quote()` for
 * an order or a cart preview — never decided here. This function only knows
 * how to fold a shipping amount into the totals, not what that amount should
 * be; the default of 0 is for callers with nothing to ship (there are none in
 * production, but it keeps this a pure function callable in isolation).
 *
 * `taxRateBps` is a parameter for the same reason `shippingService.quote`
 * takes `thresholds` as one: this stays pure and testable without wiring
 * `Settings`, and the real callers (`cart.service.ts`, `order.service.ts`)
 * fetch it once per request and pass the live value down.
 *
 * `discountCents` (M18) arrives already resolved by `coupon.service.ts` —
 * this function knows how to subtract a discount, not whether the customer
 * was entitled to one, exactly as it knows how to fold in shipping without
 * deciding the shipping rate.
 *
 * **The subtraction happens before the tax is derived, and that ordering is
 * load-bearing.** Because the IVA is *extracted* from the total rather than
 * added to it, discounting after the extraction would report tax on pesos the
 * customer never paid — a wrong number on a document the shop is legally
 * accountable for. It is also capped at `subtotalCents`, so a generous coupon
 * reduces the goods to zero but never starts refunding the shipping.
 */
function calculateTotals(
  lines: OrderLineSnapshot[],
  shippingCents = 0,
  taxRateBps: number = DEFAULT_TAX_RATE_BPS,
  discountCents = 0,
): OrderTotals {
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

  // Clamped here rather than trusted: the coupon service already bounds the
  // discount, but this function is the last place the charged amount can be
  // wrong, and a negative total or a discount that eats the shipping fee are
  // both worth making structurally impossible.
  const cappedDiscountCents = Math.min(Math.max(discountCents, 0), subtotalCents);

  const totalCents = subtotalCents - cappedDiscountCents + shippingCents;
  const taxCents = Math.round((totalCents * taxRateBps) / (10_000 + taxRateBps));

  return {
    subtotalCents,
    discountCents: cappedDiscountCents,
    taxCents,
    shippingCents,
    totalCents,
    currency: CURRENCY,
  };
}

export type { CatalogProduct, LineResolution, ResolvedLine };
export { buildLineSnapshots, calculateTotals, loadProducts, resolveCaptureMethod, resolveCartLines, resolveLineCategoryIds };
