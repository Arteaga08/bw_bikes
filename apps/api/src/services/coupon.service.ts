import type { AdminCoupon, AppliedCoupon, AuditAction, CouponScope, OrderLineSnapshot } from "@bw-bikes/shared";
import { logger } from "../config/logger.js";
import type { ICoupon } from "../models/index.js";
import { Coupon, CouponRedemption, MIN_CHARGEABLE_CENTS } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { resolveLineCategoryIds } from "./order-pricing.js";

const MODULE_NAME = "marketing.coupons";
const SORTABLE_FIELDS = ["createdAt", "code", "expiresAt", "redemptionCount"] as const;

/** Mongo's duplicate-key code. Meaningful here rather than exceptional — see `redeem`. */
const DUPLICATE_KEY = 11000;

interface CouponInput {
  code?: string;
  name?: string;
  type?: AdminCoupon["type"];
  percentOffBps?: number;
  amountOffCents?: number;
  maxDiscountCents?: number;
  minSubtotalCents?: number;
  scope?: CouponScope;
  startsAt?: string;
  expiresAt?: string;
  maxRedemptionsTotal?: number;
  maxRedemptionsPerCustomer?: number;
  isActive?: boolean;
}

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

export function toAdminCoupon(coupon: ICoupon): AdminCoupon {
  return {
    id: String(coupon._id),
    code: coupon.code,
    name: coupon.name,
    type: coupon.type,
    ...(coupon.percentOffBps !== undefined ? { percentOffBps: coupon.percentOffBps } : {}),
    ...(coupon.amountOffCents !== undefined ? { amountOffCents: coupon.amountOffCents } : {}),
    ...(coupon.maxDiscountCents !== undefined ? { maxDiscountCents: coupon.maxDiscountCents } : {}),
    ...(coupon.minSubtotalCents !== undefined ? { minSubtotalCents: coupon.minSubtotalCents } : {}),
    scope: {
      kind: coupon.scope.kind,
      ...(coupon.scope.categoryIds ? { categoryIds: coupon.scope.categoryIds } : {}),
      ...(coupon.scope.itemType ? { itemType: coupon.scope.itemType } : {}),
    },
    ...(coupon.startsAt ? { startsAt: coupon.startsAt.toISOString() } : {}),
    ...(coupon.expiresAt ? { expiresAt: coupon.expiresAt.toISOString() } : {}),
    ...(coupon.maxRedemptionsTotal !== undefined ? { maxRedemptionsTotal: coupon.maxRedemptionsTotal } : {}),
    maxRedemptionsPerCustomer: coupon.maxRedemptionsPerCustomer,
    redemptionCount: coupon.redemptionCount,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}

function toAppliedCoupon(coupon: ICoupon, discountCents: number): AppliedCoupon {
  return { couponId: String(coupon._id), code: coupon.code, type: coupon.type, discountCents };
}

/** Codes are stored uppercase, so every lookup normalises before it queries. */
function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

async function assertCodeIsFree(code: string, selfId?: string): Promise<void> {
  const filter: Record<string, unknown> = { code };
  if (selfId) filter["_id"] = { $ne: selfId };

  const existing = await Coupon.exists(filter);
  if (existing) {
    throw new AppError(`Ya existe un cupón con el código "${code}".`, 409);
  }
}

async function findByIdOrFail(id: string): Promise<ICoupon> {
  const coupon = await Coupon.findById(id).exec();
  if (!coupon) {
    throw new AppError("Cupón no encontrado.", 404);
  }
  return coupon;
}

async function list(query: Record<string, unknown>) {
  const { page, limit, skip, sort, search } = parseListQuery(query, {
    allowedSortFields: SORTABLE_FIELDS,
    defaultSort: "-createdAt",
  });

  const filter: Record<string, unknown> = {};
  if (typeof query["isActive"] === "boolean") {
    filter["isActive"] = query["isActive"];
  }
  if (search) {
    // Both fields, because an admin hunting for a campaign remembers either
    // the code they printed or the name they typed.
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    filter["$or"] = [{ code: pattern }, { name: pattern }];
  }

  const [documents, total] = await Promise.all([
    Coupon.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
    Coupon.countDocuments(filter).exec(),
  ]);

  return { documents: documents as unknown as ICoupon[], meta: buildMeta(total, page, limit) };
}

async function create(input: CouponInput, actor: ActorContext): Promise<ICoupon> {
  const code = normalizeCode(input.code!);
  await assertCodeIsFree(code);

  const coupon = await Coupon.create({
    code,
    name: input.name,
    type: input.type,
    ...(input.percentOffBps !== undefined ? { percentOffBps: input.percentOffBps } : {}),
    ...(input.amountOffCents !== undefined ? { amountOffCents: input.amountOffCents } : {}),
    ...(input.maxDiscountCents !== undefined ? { maxDiscountCents: input.maxDiscountCents } : {}),
    ...(input.minSubtotalCents !== undefined ? { minSubtotalCents: input.minSubtotalCents } : {}),
    scope: input.scope ?? { kind: "all" },
    ...(input.startsAt ? { startsAt: new Date(input.startsAt) } : {}),
    ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt) } : {}),
    ...(input.maxRedemptionsTotal !== undefined ? { maxRedemptionsTotal: input.maxRedemptionsTotal } : {}),
    maxRedemptionsPerCustomer: input.maxRedemptionsPerCustomer ?? 1,
    isActive: input.isActive ?? true,
  });

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "coupon.created" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: String(coupon._id),
    after: { code: coupon.code, name: coupon.name, type: coupon.type },
    ip: actor.ip,
  });

  return coupon;
}

async function update(id: string, input: CouponInput, actor: ActorContext): Promise<ICoupon> {
  const coupon = await findByIdOrFail(id);
  const before = { code: coupon.code, name: coupon.name, isActive: coupon.isActive };

  if (input.code !== undefined) {
    const code = normalizeCode(input.code);
    if (code !== coupon.code) {
      await assertCodeIsFree(code, id);
      coupon.code = code;
    }
  }
  if (input.name !== undefined) coupon.name = input.name;
  if (input.type !== undefined) coupon.type = input.type;
  if (input.percentOffBps !== undefined) coupon.percentOffBps = input.percentOffBps;
  if (input.amountOffCents !== undefined) coupon.amountOffCents = input.amountOffCents;
  if (input.maxDiscountCents !== undefined) coupon.maxDiscountCents = input.maxDiscountCents;
  if (input.minSubtotalCents !== undefined) coupon.minSubtotalCents = input.minSubtotalCents;
  if (input.scope !== undefined) coupon.scope = input.scope;
  if (input.startsAt !== undefined) coupon.startsAt = new Date(input.startsAt);
  if (input.expiresAt !== undefined) coupon.expiresAt = new Date(input.expiresAt);
  if (input.maxRedemptionsTotal !== undefined) coupon.maxRedemptionsTotal = input.maxRedemptionsTotal;
  if (input.maxRedemptionsPerCustomer !== undefined) {
    coupon.maxRedemptionsPerCustomer = input.maxRedemptionsPerCustomer;
  }
  if (input.isActive !== undefined) coupon.isActive = input.isActive;

  // `save()` and not `findOneAndUpdate`: the `pre("validate")` hook holds the
  // percent/amount exclusivity, and Mongoose skips it on an update query even
  // with `runValidators` — the same reasoning `settings.service.ts` documents.
  await coupon.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "coupon.updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before,
    after: { code: coupon.code, name: coupon.name, isActive: coupon.isActive },
    ip: actor.ip,
  });

  return coupon;
}

/**
 * Deletes only a campaign nobody ever used.
 *
 * Once a coupon has been redeemed it is part of an order's history: deleting
 * it would leave the ledger pointing at nothing and an order claiming a
 * discount from a campaign that no longer exists. Deactivating stops it being
 * redeemed again, which is the actual intent behind "borrar este cupón".
 */
async function remove(id: string, actor: ActorContext): Promise<void> {
  const coupon = await findByIdOrFail(id);

  const redemptions = await CouponRedemption.countDocuments({ couponId: coupon._id }).exec();
  if (redemptions > 0) {
    throw new AppError(
      `No se puede eliminar el cupón porque ya fue canjeado ${redemptions} vez(ces). Desactívalo en su lugar.`,
      409,
    );
  }

  await coupon.deleteOne();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "coupon.deleted" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before: { code: coupon.code, name: coupon.name },
    ip: actor.ip,
  });
}

/**
 * The subtotal the discount is allowed to bite into.
 *
 * Everything outside the scope is invisible to the coupon: a "20% en
 * accesorios" campaign applied to a cart holding a bike and a helmet
 * discounts the helmet only. The category lookup runs solely for
 * `kind: "categories"` — the other three kinds are answerable from the
 * snapshots the caller already has.
 */
async function eligibleSubtotal(scope: CouponScope, lines: OrderLineSnapshot[]): Promise<number> {
  const sum = (matching: OrderLineSnapshot[]): number =>
    matching.reduce((total, line) => total + line.lineTotalCents, 0);

  if (scope.kind === "all") return sum(lines);
  if (scope.kind === "bikes") return sum(lines.filter((line) => line.itemType === "bike"));
  if (scope.kind === "accessories") return sum(lines.filter((line) => line.itemType === "accessory"));

  const allowed = new Set(scope.categoryIds ?? []);
  const candidates = lines.filter((line) => line.itemType === scope.itemType);
  if (candidates.length === 0 || allowed.size === 0) return 0;

  const categories = await resolveLineCategoryIds(candidates);
  return sum(
    candidates.filter((line) => {
      const categoryId = categories.get(`${line.itemType}:${line.itemId}`);
      return categoryId !== undefined && allowed.has(categoryId);
    }),
  );
}

function computeDiscount(coupon: ICoupon, eligibleCents: number): number {
  if (coupon.type === "percent_off") {
    // `floor`, not `round`: when a discount has to land between two cents, the
    // half-cent belongs to the shop, and rounding up would let a percentage
    // coupon exceed its own stated ceiling by one.
    const raw = Math.floor((eligibleCents * (coupon.percentOffBps ?? 0)) / 10_000);
    return coupon.maxDiscountCents !== undefined ? Math.min(raw, coupon.maxDiscountCents) : raw;
  }
  return Math.min(coupon.amountOffCents ?? 0, eligibleCents);
}

interface EvaluateInput {
  code: string;
  userId: string;
  lines: OrderLineSnapshot[];
  subtotalCents: number;
  shippingCents: number;
}

interface EvaluateResult {
  coupon: ICoupon;
  discountCents: number;
  applied: AppliedCoupon;
}

/**
 * Decides whether this customer may use this code on this cart, and for how
 * much.
 *
 * Every rejection is an `AppError` with a Spanish message the storefront can
 * render as-is. The checks are ordered so the customer learns the most
 * actionable thing first: "expiró" before "no aplica a tus productos", because
 * one of those is worth reading and the other is worth acting on.
 *
 * Nothing here writes. Evaluation runs on every cart render, and the cart must
 * stay a read.
 */
async function evaluate(input: EvaluateInput): Promise<EvaluateResult> {
  const code = normalizeCode(input.code);
  const coupon = await Coupon.findOne({ code }).exec();

  // One message for "no existe" and "está desactivado": a customer can do
  // nothing different about either, and separate answers would turn this into
  // a probe for which campaigns the shop is running.
  if (!coupon || !coupon.isActive) {
    throw new AppError("Este cupón no es válido.", 404);
  }

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    throw new AppError("Este cupón todavía no está vigente.", 409);
  }
  if (coupon.expiresAt && now >= coupon.expiresAt) {
    throw new AppError("Este cupón ya expiró.", 409);
  }

  if (coupon.maxRedemptionsTotal !== undefined && coupon.redemptionCount >= coupon.maxRedemptionsTotal) {
    throw new AppError("Este cupón ya alcanzó su límite de canjes.", 409);
  }

  const usedByCustomer = await CouponRedemption.countDocuments({
    couponId: coupon._id,
    userId: input.userId,
  }).exec();
  if (usedByCustomer >= coupon.maxRedemptionsPerCustomer) {
    throw new AppError("Ya usaste este cupón el máximo de veces permitido.", 409);
  }

  // Against the whole subtotal, not the scoped one: "en compras mayores a
  // $5,000" is what the customer read, and their cart total is the number
  // they can actually see.
  if (coupon.minSubtotalCents !== undefined && input.subtotalCents < coupon.minSubtotalCents) {
    const minimum = (coupon.minSubtotalCents / 100).toFixed(2);
    throw new AppError(`Este cupón aplica en compras desde $${minimum} MXN.`, 409);
  }

  const eligibleCents = await eligibleSubtotal(coupon.scope, input.lines);
  if (eligibleCents <= 0) {
    throw new AppError("Este cupón no aplica a los productos de tu carrito.", 409);
  }

  const discountCents = computeDiscount(coupon, eligibleCents);
  if (discountCents <= 0) {
    throw new AppError("Este cupón no genera un descuento en tu carrito.", 409);
  }

  // The gateway has a floor, and finding out about it at the payment step
  // leaves the customer with an error they cannot act on. Refuse here, while
  // removing the coupon or adding a product is still an obvious fix.
  const payableCents = input.subtotalCents - discountCents + input.shippingCents;
  if (payableCents < MIN_CHARGEABLE_CENTS) {
    const minimum = (MIN_CHARGEABLE_CENTS / 100).toFixed(2);
    throw new AppError(`Con este cupón el total queda por debajo del mínimo de $${minimum} MXN para pagar.`, 409);
  }

  return { coupon, discountCents, applied: toAppliedCoupon(coupon, discountCents) };
}

/**
 * The same evaluation, as a verdict instead of an exception — the shape
 * `resolveCartLines` uses in `order-pricing.ts`, and for the same reason.
 *
 * The cart has to *render* with a coupon that quietly stopped being usable:
 * expired overnight, ran out, or no longer matches the basket. Throwing there
 * would leave a customer unable to see their own cart until they guessed that
 * a stale code was the cause.
 *
 * But "Aplicar" needs the opposite — the precise reason, in Spanish. Returning
 * the verdict serves both from **one** evaluation, which is what keeps the two
 * paths from disagreeing about whether a code works.
 */
type CouponVerdict = { ok: true; result: EvaluateResult } | { ok: false; error: AppError };

async function evaluateSafely(input: EvaluateInput): Promise<CouponVerdict> {
  try {
    return { ok: true, result: await evaluate(input) };
  } catch (error) {
    if (error instanceof AppError) {
      logger.debug({ err: error, code: input.code }, "Cart coupon is not applicable");
      return { ok: false, error };
    }
    throw error;
  }
}

interface RedeemInput {
  coupon: ICoupon;
  userId: string;
  orderId: string;
  discountCents: number;
}

/**
 * Spends one redemption, atomically.
 *
 * Two things can go wrong here and they need opposite handling. The campaign
 * running out between `evaluate` and now is a real conflict — two customers
 * raced for the last redemption and one has to lose. The *same order*
 * redeeming twice is not a conflict at all: it is `replayCheckout` or a
 * retried request arriving again, and the correct response is to do nothing
 * and report success.
 *
 * The conditional `$inc` handles the first; the ledger's unique
 * `{couponId, orderId}` index handles the second. Note the order — the counter
 * moves first, so a duplicate row means the counter was already incremented by
 * the original call and this one has to give it back.
 */
async function redeem(input: RedeemInput): Promise<void> {
  const claimed = await Coupon.findOneAndUpdate(
    {
      _id: input.coupon._id,
      isActive: true,
      $or: [
        { maxRedemptionsTotal: { $exists: false } },
        { $expr: { $lt: ["$redemptionCount", "$maxRedemptionsTotal"] } },
      ],
    },
    { $inc: { redemptionCount: 1 } },
    { new: true },
  ).exec();

  if (!claimed) {
    throw new AppError("Este cupón ya alcanzó su límite de canjes.", 409);
  }

  try {
    await CouponRedemption.create({
      couponId: input.coupon._id,
      userId: input.userId,
      orderId: input.orderId,
      code: input.coupon.code,
      discountCents: input.discountCents,
    });
  } catch (error) {
    if (error instanceof Error && (error as { code?: number }).code === DUPLICATE_KEY) {
      // This order already redeemed. Hand the increment back and treat the
      // call as the no-op it is.
      await Coupon.updateOne({ _id: input.coupon._id }, { $inc: { redemptionCount: -1 } }).exec();
      return;
    }
    await Coupon.updateOne({ _id: input.coupon._id }, { $inc: { redemptionCount: -1 } }).exec();
    throw error;
  }
}

/**
 * Returns a redemption to the pool when its order dies before it was ever paid.
 *
 * Called from the checkout's own failure path and from every cancellation of
 * an unpaid order. **Not** called on a refund: that sale happened, the campaign
 * was genuinely spent, and handing the coupon back would let a customer farm
 * an unlimited discount by buying and returning.
 *
 * Best-effort by design — the order is already being closed, and failing to
 * tidy a counter must not turn a clean cancellation into a 500.
 */
async function releaseForOrder(orderId: string, actor?: ActorContext): Promise<void> {
  try {
    const redemption = await CouponRedemption.findOneAndDelete({ orderId }).exec();
    if (!redemption) return;

    // Guarded so a double release can't drive the counter negative.
    await Coupon.updateOne(
      { _id: redemption.couponId, redemptionCount: { $gt: 0 } },
      { $inc: { redemptionCount: -1 } },
    ).exec();

    await recordAuditLog({
      actorType: actor ? "user" : "system",
      ...(actor ? { actorId: actor.actorId } : {}),
      action: "coupon.redemption_released" satisfies AuditAction,
      module: MODULE_NAME,
      targetId: String(redemption.couponId),
      before: { code: redemption.code, orderId, discountCents: redemption.discountCents },
      ...(actor?.ip ? { ip: actor.ip } : {}),
    });
  } catch (error) {
    logger.error({ err: error, orderId }, "Failed to release the coupon redemption for a closed order");
  }
}

export type { CouponVerdict };

export const couponService = {
  list,
  findByIdOrFail,
  create,
  update,
  remove,
  evaluate,
  evaluateSafely,
  redeem,
  releaseForOrder,
};
