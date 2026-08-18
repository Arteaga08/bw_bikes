import type {
  AdminInventoryItem,
  AdminInventoryProductInfo,
  AdminInventoryVariantInfo,
  FulfillmentMode,
  InventoryAvailability,
  InventorySummary,
  InventorySummaryGroup,
  ItemType,
  ReservationReferenceType,
} from "@bw-bikes/shared";
import type { ClientSession, Model } from "mongoose";
import { Types } from "mongoose";
import { logger } from "../config/logger.js";
import type { IInventoryItem, IStockReservation } from "../models/index.js";
import {
  Accessory,
  AccessoryCategory,
  Bike,
  BikeCategory,
  InventoryItem,
  MAX_ON_HAND,
  MAX_RESERVATION_QTY,
  StockReservation,
} from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery, withOptionalTransaction } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import type { ActorContext } from "./product.service.js";
import { settingsService } from "./settings.service.js";

const MODULE_NAME = "inventory";

const SORTABLE_FIELDS = ["createdAt", "sku", "onHand", "available"] as const;

/** Cap on one expiry sweep, so a long backlog can't hold the event loop hostage. */
const EXPIRY_BATCH_SIZE = 500;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** Which catalog a `{ itemType, itemId, sku }` triplet points at. */
const CATALOG_MODELS: Record<ItemType, Model<{ variants: { sku: string }[] }>> = {
  bike: Bike as unknown as Model<{ variants: { sku: string }[] }>,
  accessory: Accessory as unknown as Model<{ variants: { sku: string }[] }>,
};

/**
 * Same mapping, wider projection — `Bike`/`Accessory` are two genuinely
 * distinct Mongoose models, so a plain `itemType === "bike" ? Bike :
 * Accessory` ternary produces a union of incompatible overloaded `.find()`
 * signatures TS can't call. Routing through one record typed against the
 * shape every read here actually needs sidesteps that, the same way
 * `CATALOG_MODELS` above already does for `assertVariantExists`.
 */
interface CatalogProductDoc {
  _id: Types.ObjectId;
  name: string;
  brand: unknown;
  category: Types.ObjectId;
  gallery: { url: string; order: number }[];
  variants: { sku: string; size?: string; color?: string; fulfillmentMode: FulfillmentMode }[];
}

const CATALOG_LOOKUP_MODELS: Record<ItemType, Model<CatalogProductDoc>> = {
  bike: Bike as unknown as Model<CatalogProductDoc>,
  accessory: Accessory as unknown as Model<CatalogProductDoc>,
};

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  bike: "bicicleta",
  accessory: "accesorio",
};

/** One line of a checkout, as the cart/order layer of M5 will hand it over. */
export interface ReservationLine {
  itemType: ItemType;
  itemId: string;
  sku: string;
  qty: number;
  fulfillmentMode: FulfillmentMode;
}

/** Whatever holds the reservation — a cart or an order. */
export interface ReservationRef {
  referenceType: ReservationReferenceType;
  referenceId: string;
}

export interface ReserveOptions extends ReservationRef {
  userId?: string | undefined;
  /** Overrides `STOCK_RESERVATION_TTL_MINUTES` for this hold. */
  ttlMinutes?: number | undefined;
}

/**
 * What a line turned into. `heldInInventory: false` is not a failure — it's an
 * `on_request`/`preorder` line, which by definition holds no physical units and
 * therefore has no reservation document behind it.
 */
export interface ReservedLine extends ReservationLine {
  heldInInventory: boolean;
  reservationId?: string;
  expiresAt?: Date;
}

export interface CreateInventoryItemInput {
  itemType: ItemType;
  itemId: string;
  sku: string;
  onHand?: number;
  lowStockThreshold?: number;
}

/** One `productVariantSchema` row's worth of what `seedInitialStock` needs — never the full `ProductVariant`, so this stays agnostic of every other field a variant carries. */
export interface InitialStockVariant {
  sku: string;
  fulfillmentMode: FulfillmentMode;
  initialStock?: number;
}

export interface AdjustStockInput {
  /** Absolute new physical count. Mutually exclusive with `delta`. */
  onHand?: number;
  /** Signed change to the physical count. Mutually exclusive with `onHand`. */
  delta?: number;
  reason?: string;
}

function toObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`El identificador de ${label} es inválido.`, 400);
  }
  return new Types.ObjectId(value);
}

function assertQty(qty: number, sku: string): void {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_RESERVATION_QTY) {
    throw new AppError(`La cantidad solicitada para el SKU ${sku} no es válida.`, 400);
  }
}

function purgeDateFrom(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() + retentionDays * MS_PER_DAY);
}

function toAvailability(item: IInventoryItem): InventoryAvailability {
  return {
    itemType: item.itemType,
    itemId: String(item.itemId),
    sku: item.sku,
    onHand: item.onHand,
    reserved: item.reserved,
    available: item.onHand - item.reserved,
  };
}

/**
 * A SKU counts as low stock at or below its **effective** threshold: its own
 * `lowStockThreshold` override if one was set, otherwise the store-wide
 * `Settings.inventory.lowStockThresholdUnits` (M11). Exported so
 * `services/stats/inventory.stats.ts` reads the exact same definition of "low
 * stock" as the admin list's `stock=low` filter, not a second one that could
 * drift from this one — `stats/` depends on this module, never the reverse.
 */
export function lowStockMatchExpr(defaultThreshold: number): Record<string, unknown> {
  const availableExpr = { $subtract: ["$onHand", "$reserved"] };
  const thresholdExpr = { $ifNull: ["$lowStockThreshold", defaultThreshold] };
  return { $and: [{ $gt: [availableExpr, 0] }, { $lte: [availableExpr, thresholdExpr] }] };
}

/** What a row is stock *for* — resolved by joining against the catalog, never stored on the row. */
interface CatalogLookupEntry {
  name: string;
  brandName: string;
  imageUrl?: string;
  variants: { sku: string; size?: string; color?: string; fulfillmentMode: FulfillmentMode }[];
}

/**
 * Batch-resolves name/brand/gallery/variants for a page of inventory rows,
 * grouped by `itemType` since bikes and accessories are separate collections.
 * Same "join after the page, not per row" shape `AdminApplication`'s
 * `applicant` field already uses — two queries per page at most, never N+1.
 */
async function loadCatalogLookup(items: IInventoryItem[]): Promise<Map<string, CatalogLookupEntry>> {
  const idsByType: Record<ItemType, Types.ObjectId[]> = { bike: [], accessory: [] };
  for (const item of items) idsByType[item.itemType].push(item.itemId);

  const lookup = new Map<string, CatalogLookupEntry>();

  for (const itemType of ["bike", "accessory"] as const) {
    const ids = idsByType[itemType];
    if (ids.length === 0) continue;

    const docs = await CATALOG_LOOKUP_MODELS[itemType]
      .find({ _id: { $in: ids } })
      .select("name brand gallery variants")
      .populate("brand", "name")
      .exec();

    for (const doc of docs) {
      const brandDoc = doc.brand as unknown as { name: string } | null;
      const gallery = [...doc.gallery].sort((a, b) => a.order - b.order);
      lookup.set(String(doc._id), {
        name: doc.name,
        brandName: brandDoc?.name ?? "",
        imageUrl: gallery[0]?.url,
        variants: doc.variants,
      });
    }
  }

  return lookup;
}

/**
 * What the admin endpoints return. Built field by field like the catalog DTOs
 * rather than shipping the raw document, because `available` (and now
 * `product`/`variant`/the effective threshold) is what the panel actually
 * acts on, and none of it exists on the stored row.
 */
function toAdminInventoryItem(
  item: IInventoryItem,
  lookup: Map<string, CatalogLookupEntry>,
  defaultThreshold: number,
): AdminInventoryItem {
  const entry = lookup.get(String(item.itemId));
  const matchedVariant = entry?.variants.find((variant) => variant.sku === item.sku);

  const product: AdminInventoryProductInfo | null = entry
    ? {
        name: entry.name,
        brand: entry.brandName,
        ...(entry.imageUrl !== undefined ? { imageUrl: entry.imageUrl } : {}),
      }
    : null;

  const variant: AdminInventoryVariantInfo | null = matchedVariant
    ? {
        ...(matchedVariant.size ? { size: matchedVariant.size } : {}),
        ...(matchedVariant.color ? { color: matchedVariant.color } : {}),
        fulfillmentMode: matchedVariant.fulfillmentMode,
      }
    : null;

  return {
    id: String(item._id),
    ...toAvailability(item),
    product,
    variant,
    lowStockThresholdUnits: item.lowStockThreshold ?? defaultThreshold,
    ...(item.lastRestockedAt ? { lastRestockedAt: item.lastRestockedAt.toISOString() } : {}),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

/** Single-item version of the same enrichment, for the create/get/adjust endpoints that hand back one row. */
async function toEnrichedAdminItem(item: IInventoryItem): Promise<AdminInventoryItem> {
  const { inventory } = await settingsService.get();
  const lookup = await loadCatalogLookup([item]);
  return toAdminInventoryItem(item, lookup, inventory.lowStockThresholdUnits);
}

/**
 * Hands `qty` units of a SKU back to availability.
 *
 * Nothing else in this file decrements `reserved` on a line that has a
 * reservation document: whoever needs to give units back goes through the
 * atomic claim below first. The `$expr` guard is the last line of defence —
 * if it ever fails to match, the counter and the reservations disagree, which
 * is a bug worth an error-level log rather than a silent negative counter.
 */
async function decrementReserved(
  hold: { itemType: ItemType; itemId: Types.ObjectId; sku: string; qty: number },
  context: string,
  session?: ClientSession,
): Promise<void> {
  const result = await InventoryItem.updateOne(
    {
      itemType: hold.itemType,
      itemId: hold.itemId,
      sku: hold.sku,
      $expr: { $gte: ["$reserved", hold.qty] },
    },
    { $inc: { reserved: -hold.qty } },
    { session },
  ).exec();

  if (result.matchedCount === 0) {
    logger.error(
      { sku: hold.sku, qty: hold.qty, context },
      "Inventory invariant broken: reserved counter lower than the reservation it backs",
    );
  }
}

/**
 * Claims a single reservation and gives its units back.
 *
 * The claim (`status: "held"` in the filter) **is the mutex**: two callers
 * racing over the same reservation — the checkout flow and the expiry job, or
 * two API instances — cannot both match it, so `reserved` is never decremented
 * twice for one hold. Returns `null` when someone else got there first, which
 * is what makes `release` idempotent rather than an error.
 *
 * The claim and the decrement are wrapped together: without a transaction, a
 * process dying between them would leave the reservation marked `released`
 * while its units stayed counted as reserved, with no record left to recover
 * from.
 */
async function releaseReservationById(
  reservationId: Types.ObjectId | string,
  context: string,
  retentionDays: number,
): Promise<IStockReservation | null> {
  return withOptionalTransaction(async (session) => {
    const now = new Date();

    const claimed = await StockReservation.findOneAndUpdate(
      { _id: reservationId, status: "held" },
      { $set: { status: "released", releasedAt: now, purgeAt: purgeDateFrom(now, retentionDays) } },
      { new: true, session },
    ).exec();

    if (!claimed) return null;

    await decrementReserved(claimed, context, session);
    return claimed;
  });
}

/**
 * Undoes a hold that never became a real reservation, because a later line of
 * the same multi-line request had no stock. Deletes rather than marking
 * `released`: the reservation is being rolled back, not concluded, and leaving
 * a terminal record for a hold that never took effect would only confuse the
 * audit trail. The delete is still an atomic claim, so the expiry job can't
 * release the same units in parallel.
 */
async function rollbackReservationById(reservationId: Types.ObjectId | string): Promise<void> {
  await withOptionalTransaction(async (session) => {
    const claimed = await StockReservation.findOneAndDelete(
      { _id: reservationId, status: "held" },
      { session },
    ).exec();
    if (!claimed) return;
    await decrementReserved(claimed, "reserve.compensation", session);
  });
}

/**
 * Holds stock for a set of checkout lines, all or nothing.
 *
 * ## Why there is no read-then-write anywhere below
 *
 * The availability check and the increment are a single Mongo command: the
 * `$expr` lives in the *filter* of the `findOneAndUpdate`. When two buyers go
 * for the last unit, Mongo serializes the two updates on that document — one
 * matches and increments, the other matches nothing and gets `null` without
 * ever having touched the winner's document. Reading `available` first and
 * deciding in Node would leave exactly the window this milestone exists to
 * close.
 *
 * ## How the two collections are kept consistent
 *
 * Holding a line writes twice — the counter *and* the reservation document —
 * and a multi-line hold multiplies that. When the deployment supports
 * transactions (any replica set, so every managed deployment) the whole thing
 * runs inside one, and a failed line aborts every write that preceded it.
 *
 * On a standalone `mongod`, where transactions don't exist, the lines are
 * applied in order and the ones already held are rolled back in reverse before
 * the 409 propagates. That covers a business failure — the case that actually
 * happens — but not a process that dies mid-way, since a dead process runs no
 * compensation. Which is exactly why production must not run standalone;
 * `supportsTransactions()` logs a warning when it finds one.
 */
async function reserve(lines: ReservationLine[], options: ReserveOptions): Promise<ReservedLine[]> {
  const ttlMinutes = options.ttlMinutes ?? (await settingsService.get()).inventory.stockReservationTtlMinutes;
  const referenceId = toObjectId(options.referenceId, "referencia");
  const userId = options.userId !== undefined ? toObjectId(options.userId, "usuario") : undefined;

  return withOptionalTransaction(async (session) => {
    const expiresAt = new Date(Date.now() + ttlMinutes * MS_PER_MINUTE);
    const reserved: ReservedLine[] = [];
    /** Everything already applied, newest last — compensated in reverse on failure. */
    const applied: { line: ReservationLine; reservationId?: Types.ObjectId }[] = [];

    try {
      for (const line of lines) {
        // `on_request` sells without owning stock (the admin confirms with the
        // supplier before the charge is captured) and `preorder` sells ahead of
        // arrival. Neither has units to hold, so neither touches inventory nor
        // leaves a reservation behind.
        if (line.fulfillmentMode !== "in_stock") {
          reserved.push({ ...line, heldInInventory: false });
          continue;
        }

        assertQty(line.qty, line.sku);
        const itemId = toObjectId(line.itemId, ITEM_TYPE_LABELS[line.itemType]);

        const item = await InventoryItem.findOneAndUpdate(
          {
            itemType: line.itemType,
            itemId,
            sku: line.sku,
            $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, line.qty] },
          },
          { $inc: { reserved: line.qty } },
          { new: true, session },
        ).exec();

        if (!item) {
          throw new AppError(`No hay unidades suficientes disponibles del SKU ${line.sku}.`, 409);
        }

        // From here on the counter is already incremented: record the line as
        // applied *before* anything else can fail, so the fallback path's
        // compensation can find it.
        applied.push({ line });

        // Array form because that's the only signature that accepts a session.
        const [reservation] = await StockReservation.create(
          [
            {
              itemType: line.itemType,
              itemId,
              sku: line.sku,
              qty: line.qty,
              referenceType: options.referenceType,
              referenceId,
              ...(userId !== undefined ? { userId } : {}),
              status: "held",
              expiresAt,
            },
          ],
          { session },
        );

        const reservationId = reservation?._id as Types.ObjectId;
        applied[applied.length - 1] = { line, reservationId };
        reserved.push({
          ...line,
          heldInInventory: true,
          reservationId: String(reservationId),
          expiresAt,
        });
      }
    } catch (error) {
      // Inside a transaction the abort undoes every write above, so running
      // compensation too would decrement counters a second time.
      if (!session) await compensate(applied);
      throw error;
    }

    return reserved;
  });
}

/** Best-effort rollback: a failure here is logged, never masks the original error. */
async function compensate(applied: { line: ReservationLine; reservationId?: Types.ObjectId }[]): Promise<void> {
  for (const entry of applied.reverse()) {
    try {
      if (entry.reservationId) {
        await rollbackReservationById(entry.reservationId);
        continue;
      }

      // The counter was incremented but the reservation document never made
      // it, so there is nothing to claim — give the units back directly.
      await decrementReserved(
        {
          itemType: entry.line.itemType,
          itemId: toObjectId(entry.line.itemId, ITEM_TYPE_LABELS[entry.line.itemType]),
          sku: entry.line.sku,
          qty: entry.line.qty,
        },
        "reserve.compensation.orphan",
      );
    } catch (error) {
      logger.error({ err: error, sku: entry.line.sku }, "Failed to compensate a stock reservation");
    }
  }
}

/**
 * Gives back everything a cart or order holds. Idempotent: reservations
 * already released or committed are skipped by the claim, so calling this
 * after a payment failure, after an abandoned checkout *and* after the expiry
 * job already got there decrements the counter exactly once.
 *
 * Returns how many reservations this call actually released.
 */
async function release(ref: ReservationRef): Promise<number> {
  const { inventory } = await settingsService.get();
  const reservations = await StockReservation.find({
    referenceType: ref.referenceType,
    referenceId: toObjectId(ref.referenceId, "referencia"),
    status: "held",
  }).exec();

  let released = 0;
  for (const reservation of reservations) {
    if (await releaseReservationById(reservation._id as Types.ObjectId, "release", inventory.reservationRetentionDays)) {
      released++;
    }
  }
  return released;
}

/**
 * Turns held units into a sale: they leave physical stock and stop being
 * reserved in the same atomic increment. Called by M5 when the payment webhook
 * confirms success — never on a redirect.
 *
 * Same claim-then-increment shape as `release`, so a commit racing a release
 * (payment confirmed at the exact moment the hold expired) resolves to
 * whichever claims first, never to both.
 */
async function commit(ref: ReservationRef): Promise<number> {
  const { inventory } = await settingsService.get();
  const reservations = await StockReservation.find({
    referenceType: ref.referenceType,
    referenceId: toObjectId(ref.referenceId, "referencia"),
    status: "held",
  }).exec();

  let committed = 0;

  for (const reservation of reservations) {
    // One transaction per reservation: the claim and the stock movement have
    // to land together, but two lines of the same order are independent.
    const didCommit = await withOptionalTransaction(async (session) => {
      const now = new Date();

      const claimed = await StockReservation.findOneAndUpdate(
        { _id: reservation._id, status: "held" },
        { $set: { status: "committed", committedAt: now, purgeAt: purgeDateFrom(now, inventory.reservationRetentionDays) } },
        { new: true, session },
      ).exec();

      if (!claimed) return false;

      const result = await InventoryItem.updateOne(
        {
          itemType: claimed.itemType,
          itemId: claimed.itemId,
          sku: claimed.sku,
          $expr: {
            $and: [{ $gte: ["$onHand", claimed.qty] }, { $gte: ["$reserved", claimed.qty] }],
          },
        },
        { $inc: { onHand: -claimed.qty, reserved: -claimed.qty } },
        { session },
      ).exec();

      if (result.matchedCount === 0) {
        // The sale stands (the customer paid); what's broken is the counter, so
        // this needs a human, not a rollback of a completed order.
        logger.error(
          { sku: claimed.sku, qty: claimed.qty },
          "Inventory invariant broken: committed a reservation the counters could not cover",
        );
      }

      return true;
    });

    if (didCommit) committed++;
  }

  return committed;
}

/**
 * Pushes back the deadline of everything a reference still holds, and returns
 * how many holds moved.
 *
 * This exists for exactly one situation, and it is the mixed cart that defines
 * this shop: a bike sold `on_request` together with an in-stock helmet. The
 * order authorizes the card and waits — possibly for days — while the owner
 * confirms the bike with the supplier. The helmet, meanwhile, *is* holding
 * physical units on a checkout-length deadline. Without this, the reaper would
 * hand the helmet back mid-confirmation and the capture would succeed for
 * stock that no longer exists.
 *
 * Only `held` reservations are touched, so a hold that already committed or
 * was released stays terminal — extending a concluded reservation would
 * resurrect it. Shortening is allowed too (the parameter is a new absolute
 * deadline, not an increment): the caller decides, and both directions are
 * legitimate.
 *
 * Deliberately a plain `updateMany` and not a claim-then-write: moving a
 * deadline is not a stock movement. It touches no counter, so there is nothing
 * for a racing caller to double-apply.
 */
async function extendHold(ref: ReservationRef, expiresAt: Date): Promise<number> {
  const result = await StockReservation.updateMany(
    {
      referenceType: ref.referenceType,
      referenceId: toObjectId(ref.referenceId, "referencia"),
      status: "held",
    },
    { $set: { expiresAt } },
  ).exec();

  return result.modifiedCount;
}

/**
 * Releases holds whose deadline passed and that the normal flow never cleaned
 * up — a crashed checkout, a webhook that never arrived, a browser closed
 * mid-payment. Exported rather than inlined in the job so tests can drive it
 * with an explicit clock instead of waiting on a timer.
 *
 * Safe to run on several API instances at once: the per-reservation claim
 * inside `releaseReservationById` is what serializes them, so no distributed
 * lock is needed.
 */
async function releaseExpiredReservations(now: Date = new Date()): Promise<number> {
  const { inventory } = await settingsService.get();
  const expired = await StockReservation.find({ status: "held", expiresAt: { $lte: now } })
    .limit(EXPIRY_BATCH_SIZE)
    .exec();

  let released = 0;

  for (const reservation of expired) {
    const claimed = await releaseReservationById(
      reservation._id as Types.ObjectId,
      "expiry",
      inventory.reservationRetentionDays,
    );
    if (!claimed) continue;

    released++;
    await recordAuditLog({
      actorType: "system",
      action: "inventory.reservation_expired",
      module: MODULE_NAME,
      targetId: String(claimed._id),
      before: { status: "held" },
      after: { status: "released", sku: claimed.sku, qty: claimed.qty },
    });
  }

  return released;
}

/** Missing rows read as "no stock" rather than 404 — an un-stocked SKU is simply unavailable. */
async function getAvailability(itemType: ItemType, itemId: string, sku: string): Promise<InventoryAvailability> {
  const item = await InventoryItem.findOne({
    itemType,
    itemId: toObjectId(itemId, ITEM_TYPE_LABELS[itemType]),
    sku,
  }).exec();

  if (!item) {
    return { itemType, itemId, sku, onHand: 0, reserved: 0, available: 0 };
  }
  return toAvailability(item);
}

// --- Admin surface --------------------------------------------------------

async function findByIdOrFail(id: string): Promise<IInventoryItem> {
  const item = await InventoryItem.findById(id).exec();
  if (!item) {
    throw new AppError("La entrada de inventario no existe.", 404);
  }
  return item;
}

/**
 * A root category's product ids, its own plus its children's — `itemType`
 * picks which of the two independent trees (bikes/accessories) the id
 * belongs to. Same "parent filter expands to children" shape
 * `product.service.ts`'s `buildFilter` already uses for the public catalog.
 */
async function categoryProductIds(itemType: ItemType, categoryId: string): Promise<Types.ObjectId[]> {
  const CategoryModel = itemType === "bike" ? BikeCategory : AccessoryCategory;

  const children = await CategoryModel.find({ parent: categoryId }).select("_id").exec();
  const categoryIds = [new Types.ObjectId(categoryId), ...children.map((child) => child._id as Types.ObjectId)];

  const products = await CATALOG_LOOKUP_MODELS[itemType]
    .find({ category: { $in: categoryIds } })
    .select("_id")
    .exec();
  return products.map((product) => product._id);
}

export interface ListInventoryItemsResult {
  items: AdminInventoryItem[];
  meta: ReturnType<typeof buildMeta>;
}

/**
 * Named query params only — the client's query object is never spread into the
 * filter, which is what stops `?sku[$ne]=x` from becoming a Mongo operator.
 */
async function listItems(query: Record<string, unknown>): Promise<ListInventoryItemsResult> {
  const { page, limit, skip, sort, search } = parseListQuery(query, {
    allowedSortFields: SORTABLE_FIELDS,
    defaultSort: "-createdAt",
  });

  const { inventory } = await settingsService.get();

  const filter: Record<string, unknown> = {};
  const itemType = query["itemType"];
  if (typeof itemType === "string") filter["itemType"] = itemType;

  // `itemId` (one specific product) is more specific than `category` (a
  // whole root and its children), so it wins if a caller somehow sends both.
  const itemId = query["itemId"];
  const category = query["category"];
  if (typeof itemId === "string") {
    filter["itemId"] = toObjectId(itemId, "producto");
  } else if (typeof category === "string") {
    if (typeof itemType !== "string") {
      throw new AppError("Para filtrar por categoría también debes indicar el tipo de producto.", 400);
    }
    // Joi already restricted `itemType` to the `ItemType` enum before this
    // service ever sees the query — the cast just tells TS what validation
    // already guarantees.
    filter["itemId"] = { $in: await categoryProductIds(itemType as ItemType, category) };
  }

  if (search !== undefined) filter["sku"] = { $regex: escapeRegex(search), $options: "i" };

  const stock = query["stock"];
  if (stock === "out") {
    filter["$expr"] = { $lte: [{ $subtract: ["$onHand", "$reserved"] }, 0] };
  } else if (stock === "low") {
    filter["$expr"] = lowStockMatchExpr(inventory.lowStockThresholdUnits);
  }

  const [sortField, sortDirection] = Object.entries(sort)[0] as [string, 1 | -1];

  let documents: IInventoryItem[];
  let total: number;

  if (sortField === "available") {
    // Not a stored field — `.sort()` on `find()` can't order by it, so this
    // one path goes through an aggregation that computes it first.
    [documents, total] = await Promise.all([
      InventoryItem.aggregate<IInventoryItem>([
        { $match: filter },
        { $addFields: { available: { $subtract: ["$onHand", "$reserved"] } } },
        { $sort: { available: sortDirection } },
        { $skip: skip },
        { $limit: limit },
      ]).exec(),
      InventoryItem.countDocuments(filter).exec(),
    ]);
  } else {
    [documents, total] = await Promise.all([
      InventoryItem.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      InventoryItem.countDocuments(filter).exec(),
    ]);
  }

  const lookup = await loadCatalogLookup(documents);
  const items = documents.map((doc) => toAdminInventoryItem(doc, lookup, inventory.lowStockThresholdUnits));

  return { items, meta: buildMeta(total, page, limit) };
}

/**
 * Category rollups for the inventory panel's band headers (M11) — total
 * SKUs, out-of-stock and low-stock counts per root category, without
 * fetching every row just to paint a summary. One pair of queries per root
 * (its product ids, then an aggregate over their inventory rows) rather than
 * a single cross-collection pipeline — the category count this milestone
 * targets (~5 roots) doesn't justify the complexity of a `$facet`/
 * `$unionWith` across two catalogs.
 */
async function getSummary(): Promise<InventorySummary> {
  const { inventory } = await settingsService.get();
  const groups: InventorySummaryGroup[] = [];

  for (const itemType of ["bike", "accessory"] as const) {
    const CategoryModel = itemType === "bike" ? BikeCategory : AccessoryCategory;

    const roots = await CategoryModel.find({ parent: null }).sort({ order: 1, name: 1 }).exec();

    for (const root of roots) {
      const children = await CategoryModel.find({ parent: root._id }).select("_id").exec();
      const categoryIds = [root._id as Types.ObjectId, ...children.map((child) => child._id as Types.ObjectId)];
      const products = await CATALOG_LOOKUP_MODELS[itemType]
        .find({ category: { $in: categoryIds } })
        .select("_id")
        .exec();
      const productIds = products.map((product) => product._id);

      if (productIds.length === 0) {
        groups.push({
          itemType,
          categoryId: String(root._id),
          categoryName: root.name,
          totalSkus: 0,
          outOfStockSkus: 0,
          lowStockSkus: 0,
        });
        continue;
      }

      const [row] = await InventoryItem.aggregate<{ total: number; outOfStock: number; lowStock: number }>([
        { $match: { itemType, itemId: { $in: productIds } } },
        {
          $addFields: {
            available: { $subtract: ["$onHand", "$reserved"] },
            threshold: { $ifNull: ["$lowStockThreshold", inventory.lowStockThresholdUnits] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            outOfStock: { $sum: { $cond: [{ $lte: ["$available", 0] }, 1, 0] } },
            lowStock: {
              $sum: { $cond: [{ $and: [{ $gt: ["$available", 0] }, { $lte: ["$available", "$threshold"] }] }, 1, 0] },
            },
          },
        },
      ]).exec();

      groups.push({
        itemType,
        categoryId: String(root._id),
        categoryName: root.name,
        totalSkus: row?.total ?? 0,
        outOfStockSkus: row?.outOfStock ?? 0,
        lowStockSkus: row?.lowStock ?? 0,
      });
    }
  }

  return { groups };
}

/**
 * Inventory rows are created by hand — either through this endpoint, or
 * since M11 seeded transactionally when a product is created with initial
 * stock (`seedInitialStock`) — never derived from the catalog on their own.
 * But the triplet still has to point at a variant that exists, or the row
 * would be stock for nothing that can be sold. `seedInitialStock` skips this
 * check on purpose: its variants come from the very payload the same
 * transaction is writing, so re-validating against a document that hasn't
 * committed yet would be redundant.
 */
async function assertVariantExists(itemType: ItemType, itemId: Types.ObjectId, sku: string): Promise<void> {
  const catalogModel = CATALOG_MODELS[itemType];
  const exists = await catalogModel.exists({ _id: itemId, "variants.sku": sku });

  if (!exists) {
    throw new AppError(`No existe una variante con el SKU ${sku} en ese ${ITEM_TYPE_LABELS[itemType]}.`, 404);
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

/** Shared by the manual `POST /admin/inventory` and `seedInitialStock`'s per-row logging, so the two paths that create a row write the same audit shape. */
async function recordItemCreatedAudit(item: IInventoryItem, actor: ActorContext): Promise<void> {
  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "inventory.item_created",
    module: MODULE_NAME,
    targetId: String(item._id),
    after: { itemType: item.itemType, sku: item.sku, onHand: item.onHand },
    ip: actor.ip,
  });
}

async function createItem(input: CreateInventoryItemInput, actor: ActorContext): Promise<IInventoryItem> {
  const itemId = toObjectId(input.itemId, ITEM_TYPE_LABELS[input.itemType]);
  await assertVariantExists(input.itemType, itemId, input.sku);

  let item: IInventoryItem;
  try {
    // Explicit field list, never {...input} — mass assignment protection.
    // `reserved` is deliberately absent: only a real reservation may raise it.
    item = await InventoryItem.create({
      itemType: input.itemType,
      itemId,
      sku: input.sku,
      onHand: input.onHand ?? 0,
      ...(input.lowStockThreshold !== undefined ? { lowStockThreshold: input.lowStockThreshold } : {}),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(`Ya existe una entrada de inventario para el SKU ${input.sku}.`, 409);
    }
    throw error;
  }

  await recordItemCreatedAudit(item, actor);

  return item;
}

/**
 * Seeds one `InventoryItem` row per `in_stock` variant carrying a positive
 * `initialStock` — called from inside `bike.service.ts`/`accessory.service.ts`'s
 * create transaction (M11), never on its own. `on_request`/`preorder`
 * variants are skipped (they hold no stock, the same rule `reserve()`
 * enforces), and so is a missing or zero `initialStock`. `assertVariantExists`
 * is deliberately not called — see that function's own doc comment.
 */
async function seedInitialStock(
  itemType: ItemType,
  itemId: Types.ObjectId,
  variants: InitialStockVariant[],
  session: ClientSession | undefined,
): Promise<IInventoryItem[]> {
  const created: IInventoryItem[] = [];

  for (const variant of variants) {
    if (variant.fulfillmentMode !== "in_stock") continue;
    const onHand = variant.initialStock ?? 0;
    if (onHand <= 0) continue;

    const [item] = await InventoryItem.create([{ itemType, itemId, sku: variant.sku, onHand }], { session });
    if (item) created.push(item);
  }

  return created;
}

/**
 * Changes physical stock without ever letting it fall below what's already
 * reserved — the guard is inside the update's filter, so an admin correcting a
 * count and a checkout holding the last unit can't interleave into a negative
 * availability. `delta` exists so two admins receiving the same shipment add
 * up instead of overwriting each other (a lost update); `onHand` is for a
 * physical recount, where overwriting is the intent.
 */
async function adjustStock(id: string, input: AdjustStockInput, actor: ActorContext): Promise<IInventoryItem> {
  const current = await findByIdOrFail(id);

  const filter: Record<string, unknown> = { _id: current._id };
  let update: Record<string, unknown>;

  if (input.onHand !== undefined) {
    filter["$expr"] = { $gte: [input.onHand, "$reserved"] };
    update = { $set: { onHand: input.onHand } };
  } else if (input.delta !== undefined) {
    filter["$expr"] = {
      $and: [
        { $gte: [{ $add: ["$onHand", input.delta] }, "$reserved"] },
        { $lte: [{ $add: ["$onHand", input.delta] }, MAX_ON_HAND] },
      ],
    };
    // `lastRestockedAt` moves only on a positive delta — new stock actually
    // arriving. A negative delta (write-off, damage) and an absolute `onHand`
    // recount are both real stock movements, but neither one is "we got more
    // in", which is the one question this timestamp answers.
    update =
      input.delta > 0
        ? { $inc: { onHand: input.delta }, $set: { lastRestockedAt: new Date() } }
        : { $inc: { onHand: input.delta } };
  } else {
    throw new AppError("Indica el nuevo stock físico (onHand) o un ajuste (delta).", 400);
  }

  const updated = await InventoryItem.findOneAndUpdate(filter, update, { new: true }).exec();

  if (!updated) {
    // Re-read for the message only; the decision above was already made
    // atomically, so this can't reintroduce a race.
    const latest = await InventoryItem.findById(id).exec();
    throw new AppError(
      `El ajuste dejaría el stock físico por debajo de las ${latest?.reserved ?? 0} unidades ya reservadas, o por encima del máximo permitido.`,
      409,
    );
  }

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "inventory.stock_adjusted",
    module: MODULE_NAME,
    targetId: String(updated._id),
    before: { onHand: current.onHand, reserved: current.reserved },
    after: {
      onHand: updated.onHand,
      reserved: updated.reserved,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    },
    ip: actor.ip,
  });

  return updated;
}

export const inventoryService = {
  reserve,
  release,
  commit,
  extendHold,
  releaseExpiredReservations,
  getAvailability,
  listItems,
  getSummary,
  findByIdOrFail,
  createItem,
  adjustStock,
  seedInitialStock,
  recordItemCreatedAudit,
  toEnrichedAdminItem,
};

export { toAvailability };
