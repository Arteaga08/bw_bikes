import type { BillingInfo, CartLineInput, ItemType, PublicCart, PublicCartLine, ShippingAddress } from "@bw-bikes/shared";
import { CURRENCY } from "@bw-bikes/shared";
import { Types } from "mongoose";
import type { ICart, ICartLine } from "../models/index.js";
import { Cart, MAX_CART_LINES } from "../models/index.js";
import { AppError } from "../utils/index.js";
import { inventoryService } from "./inventory.service.js";
import { calculateTotals, resolveCaptureMethod, resolveCartLines } from "./order-pricing.js";
import { settingsService } from "./settings.service.js";
import { shippingService } from "./shipping.service.js";

/**
 * The customer's shopping list.
 *
 * Two properties define this service, and both are deliberate omissions:
 *
 * 1. **It holds no stock.** Nothing here calls `inventoryService.reserve`.
 *    Availability is read and displayed, never claimed. Reserving on
 *    add-to-cart would let anyone make a six-figure bike look sold out for
 *    free — the hold happens at order creation, for the length of a payment.
 * 2. **It stores no prices.** The cart document keeps `{ itemType, itemId,
 *    sku, qty }` and nothing else; every amount shown is re-read from the
 *    catalog on each render. A price cached here is a price a customer could
 *    hold across a change — and worse, a number some future checkout might be
 *    tempted to trust.
 */

/**
 * A line is identified by **both** its catalog and its SKU. M3 made SKUs
 * unique per collection rather than globally, so a bike and an accessory may
 * legitimately share one — keying on the SKU alone would silently merge them.
 */
function lineKey(itemType: ItemType, sku: string): string {
  return `${itemType}:${sku.toUpperCase()}`;
}

function toCartLineInputs(cart: ICart): CartLineInput[] {
  return cart.lines.map((line) => ({
    itemType: line.itemType,
    itemId: String(line.itemId),
    sku: line.sku,
    qty: line.qty,
  }));
}

/** One cart per customer, created on first touch rather than at registration. */
async function findOrCreate(userId: string): Promise<ICart> {
  const existing = await Cart.findOne({ userId }).exec();
  if (existing) return existing;
  return Cart.create({ userId, lines: [] });
}

/**
 * Renders the cart: prices every line against the live catalog and asks
 * inventory what is available today.
 *
 * Availability is fetched per in-stock line rather than in one batch query.
 * The cart is capped at 20 lines, so this is at most 20 indexed point lookups
 * issued in parallel — cheap enough that a bespoke batch API on the inventory
 * service would be complexity bought with nothing.
 */
async function toPublicCart(cart: ICart): Promise<PublicCart> {
  const inputs = toCartLineInputs(cart);
  const resolutions = await resolveCartLines(inputs);

  const lines: PublicCartLine[] = await Promise.all(
    resolutions.map(async (resolution, index): Promise<PublicCartLine> => {
      const input = inputs[index]!;

      if (!resolution.ok) {
        // The line stays visible: silently dropping something the customer
        // chose is worse than showing it greyed out with a reason.
        return {
          itemType: input.itemType,
          itemId: input.itemId,
          sku: input.sku,
          slug: "",
          name: input.sku,
          brand: "",
          fulfillmentMode: "in_stock",
          unitPriceCents: 0,
          qty: input.qty,
          lineTotalCents: 0,
          available: null,
          isPurchasable: false,
          unavailableReason: resolution.reason,
        };
      }

      const { snapshot, slug } = resolution.line;

      // `null`, not 0: an `on_request` line owns no stock at all, which is a
      // different statement from "we have none left".
      let available: number | null = null;
      let isPurchasable = true;
      let unavailableReason: string | undefined;

      if (snapshot.fulfillmentMode === "in_stock") {
        const availability = await inventoryService.getAvailability(
          snapshot.itemType,
          snapshot.itemId,
          snapshot.sku,
        );
        available = availability.available;
        if (available < snapshot.qty) {
          isPurchasable = false;
          unavailableReason =
            available === 0
              ? "Este producto está agotado."
              : `Solo quedan ${available} unidades disponibles.`;
        }
      }

      return {
        ...snapshot,
        slug,
        available,
        isPurchasable,
        ...(unavailableReason !== undefined ? { unavailableReason } : {}),
      };
    }),
  );

  // Totals are computed over purchasable lines only, so the figure shown is
  // what checkout would actually charge if the customer removed the blocked
  // ones — not a total they can never pay.
  const purchasable = lines.filter((line) => line.isPurchasable);
  const purchasableSnapshots = purchasable.map((line) => ({
    itemType: line.itemType,
    itemId: line.itemId,
    sku: line.sku,
    name: line.name,
    brand: line.brand,
    fulfillmentMode: line.fulfillmentMode,
    unitPriceCents: line.unitPriceCents,
    qty: line.qty,
    lineTotalCents: line.lineTotalCents,
  }));

  // Same quote checkout will apply, so the cart can preview "Envío: Gratis"
  // or a monto before the customer ever commits to paying.
  const { shipping, pricing } = await settingsService.get();
  const shippingQuote = shippingService.quote(purchasableSnapshots, shipping);
  const totals = calculateTotals(purchasableSnapshots, shippingQuote.shippingCents, pricing.taxRateBps);

  return {
    id: String(cart._id),
    lines,
    ...(cart.shippingAddress ? { shippingAddress: cart.shippingAddress } : {}),
    ...(cart.billingInfo ? { billingInfo: cart.billingInfo } : {}),
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    shippingCents: totals.shippingCents,
    totalCents: totals.totalCents,
    currency: CURRENCY,
    captureMethod: resolveCaptureMethod(purchasable),
    hasBlockingLines: lines.some((line) => !line.isPurchasable),
    updatedAt: cart.updatedAt.toISOString(),
  };
}

async function getCart(userId: string): Promise<PublicCart> {
  return toPublicCart(await findOrCreate(userId));
}

/**
 * Confirms the SKU actually exists in the catalog before it can enter a cart.
 *
 * One 404 for "no such product", "no such variant" and "archived": the
 * customer can do nothing different about any of them, and separate answers
 * would turn add-to-cart into a probe for which product ids exist.
 */
async function assertPurchasableNow(input: CartLineInput): Promise<void> {
  const [resolution] = await resolveCartLines([input]);
  if (!resolution || !resolution.ok) {
    throw new AppError("Ese producto no está disponible.", 404);
  }
}

/**
 * Adds a line, or **increments** one that is already there. Adding the same
 * bike twice is one line of two, not two lines of one — anything else makes
 * quantity editing ambiguous for the customer.
 */
async function addLine(userId: string, input: CartLineInput): Promise<PublicCart> {
  await assertPurchasableNow(input);

  const cart = await findOrCreate(userId);
  const key = lineKey(input.itemType, input.sku);
  const existing = cart.lines.find((line) => lineKey(line.itemType, line.sku) === key);

  if (existing) {
    existing.qty = clampQty(existing.qty + input.qty);
  } else {
    if (cart.lines.length >= MAX_CART_LINES) {
      throw new AppError(`Un carrito no puede tener más de ${MAX_CART_LINES} líneas.`, 409);
    }
    cart.lines.push({
      itemType: input.itemType,
      itemId: new Types.ObjectId(input.itemId),
      sku: input.sku.toUpperCase(),
      qty: input.qty,
    } as ICartLine);
  }

  await cart.save();
  return toPublicCart(cart);
}

/** Ceiling shared with the reservation layer, so a cart can't ask for more than a hold could ever grant. */
function clampQty(qty: number): number {
  return Math.min(qty, 100);
}

/** Sets an absolute quantity — the semantics a stepper control in the UI needs. */
async function updateLine(userId: string, itemType: ItemType, sku: string, qty: number): Promise<PublicCart> {
  const cart = await findOrCreate(userId);
  const key = lineKey(itemType, sku);
  const existing = cart.lines.find((line) => lineKey(line.itemType, line.sku) === key);

  if (!existing) {
    throw new AppError("Esa línea no está en tu carrito.", 404);
  }

  existing.qty = qty;
  await cart.save();
  return toPublicCart(cart);
}

async function removeLine(userId: string, itemType: ItemType, sku: string): Promise<PublicCart> {
  const cart = await findOrCreate(userId);
  const key = lineKey(itemType, sku);
  const before = cart.lines.length;

  cart.lines = cart.lines.filter((line) => lineKey(line.itemType, line.sku) !== key);

  if (cart.lines.length === before) {
    throw new AppError("Esa línea no está en tu carrito.", 404);
  }

  await cart.save();
  return toPublicCart(cart);
}

async function clearCart(userId: string): Promise<PublicCart> {
  const cart = await findOrCreate(userId);
  cart.lines = [];
  await cart.save();
  return toPublicCart(cart);
}

/**
 * Where checkout will ship. Captured here, ahead of payment, so
 * `createOrderSchema` can stay empty — the order copies this as a snapshot
 * instead of accepting an address in the checkout body.
 */
async function setShippingAddress(userId: string, address: ShippingAddress): Promise<PublicCart> {
  const cart = await findOrCreate(userId);
  cart.shippingAddress = address;
  await cart.save();
  return toPublicCart(cart);
}

/** The raw address for the checkout to copy onto the order. `undefined` if never set. */
async function getShippingAddress(userId: string): Promise<ShippingAddress | undefined> {
  const cart = await Cart.findOne({ userId }).exec();
  return cart?.shippingAddress;
}

/**
 * Optional CFDI data (M7), captured ahead of checkout — same
 * capture-here-copy-at-checkout pattern as the shipping address, except
 * nothing ever requires it to be set.
 */
async function setBillingInfo(userId: string, billingInfo: BillingInfo): Promise<PublicCart> {
  const cart = await findOrCreate(userId);
  cart.billingInfo = billingInfo;
  await cart.save();
  return toPublicCart(cart);
}

/** The raw CFDI data for the checkout to copy onto the order. `undefined` if never set. */
async function getBillingInfo(userId: string): Promise<BillingInfo | undefined> {
  const cart = await Cart.findOne({ userId }).exec();
  return cart?.billingInfo;
}

/**
 * The raw lines, for the checkout to price and freeze. Returns the stored
 * shape rather than the rendered one on purpose: the order must re-resolve
 * everything itself at the moment of purchase, not inherit a view that was
 * built for a screen some minutes ago.
 */
async function getCheckoutLines(userId: string): Promise<CartLineInput[]> {
  const cart = await Cart.findOne({ userId }).exec();
  return cart ? toCartLineInputs(cart) : [];
}

/** Emptied once the order that consumed it exists — not before, and never on payment. */
async function emptyAfterCheckout(userId: string): Promise<void> {
  await Cart.updateOne({ userId }, { $set: { lines: [] } }).exec();
}

export const cartService = {
  getCart,
  addLine,
  updateLine,
  removeLine,
  clearCart,
  setShippingAddress,
  getShippingAddress,
  setBillingInfo,
  getBillingInfo,
  getCheckoutLines,
  emptyAfterCheckout,
};
