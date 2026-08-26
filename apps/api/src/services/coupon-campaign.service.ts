import { randomInt } from "node:crypto";
import type { AuditAction } from "@bw-bikes/shared";
import { logger } from "../config/logger.js";
import type { ICoupon } from "../models/index.js";
import { Coupon, User } from "../models/index.js";
import { AppError } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { couponService } from "./coupon.service.js";
import { createMailer } from "./mailer/index.js";

const MODULE_NAME = "marketing.coupons";

/** Bounded so one click can't fan out into an unbounded serial send. */
const MAX_RECIPIENTS = 200;

/** No `I`, `O`, `0` or `1`: a customer reads this off a screen and types it. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GENERATED_CODE_LENGTH = 8;
const CODE_ATTEMPTS = 5;

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

/**
 * Escapes an admin's free text so it can be dropped into the email template.
 *
 * **This is the only untrusted string that reaches `renderTransactionalEmail`,
 * whose contract says its paragraphs are already-safe HTML written by this
 * codebase.** Escaping here, rather than leaning on `sanitizeInput`, is
 * deliberate: that middleware sits two layers away and scrubs request bodies
 * generally — it is not where a guarantee this specific should live, and it
 * does not run at all when this service is called from a script or a test.
 *
 * **`&` is deliberately not escaped, and that is the whole subtlety.**
 * `sanitizeInput` has already run `filterXSS` over the body by the time an
 * HTTP request reaches here, so `<script>` arrives as `&lt;script&gt;`.
 * Escaping the ampersand again would turn it into `&amp;lt;script&amp;gt;` and
 * the customer would read literal entity codes in their email — safe, but
 * visibly broken. Leaving `&` alone makes this pass idempotent: text the
 * middleware already escaped survives unchanged, and raw text arriving by any
 * other path still gets its angle brackets neutralised. Escaping `<` is what
 * carries the security guarantee; no tag can be reconstructed without it.
 *
 * Line breaks become `<br>` so a message typed with paragraphs still reads
 * like one.
 */
function escapeMessage(message: string): string {
  return message
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\r?\n/g, "<br>");
}

/** "10% de descuento" / "$500.00 MXN de descuento" — what the customer is being offered. */
function discountLabel(coupon: ICoupon): string {
  if (coupon.type === "percent_off") {
    return `${(coupon.percentOffBps ?? 0) / 100}% de descuento`;
  }
  return `$${((coupon.amountOffCents ?? 0) / 100).toFixed(2)} MXN de descuento`;
}

function generateCode(): string {
  let code = "";
  for (let index = 0; index < GENERATED_CODE_LENGTH; index++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** One outcome per recipient, so the panel can say "38 enviados, 2 fallaron". */
interface SendResult {
  userId: string;
  email?: string;
  status: "sent" | "failed" | "skipped";
  reason?: string;
}

interface SendSummary {
  results: SendResult[];
  summary: { sent: number; failed: number; skipped: number };
}

function summarize(results: SendResult[]): SendSummary {
  return {
    results,
    summary: {
      sent: results.filter((result) => result.status === "sent").length,
      failed: results.filter((result) => result.status === "failed").length,
      skipped: results.filter((result) => result.status === "skipped").length,
    },
  };
}

/**
 * Sends one coupon to many customers.
 *
 * A **serial loop with a per-recipient `catch`**, the same shape
 * `order.service.ts`'s `bulkUpdateStatus` uses: one bad address must not abort
 * the other thirty-nine, and the caller needs to know exactly which ones
 * didn't land. Parallelising it would trade that for a burst against the mail
 * provider's rate limit — the slow version is the correct one here.
 *
 * Sending does **not** redeem anything. The coupon is spent when an order uses
 * it, which is the only moment the shop actually pays for the discount; a
 * campaign emailed to a hundred people who never buy has cost nothing and must
 * not show a hundred redemptions.
 */
async function sendExisting(
  input: { couponId: string; userIds: string[]; message?: string },
  actor: ActorContext,
): Promise<SendSummary> {
  if (input.userIds.length === 0) {
    throw new AppError("Selecciona al menos un cliente.", 400);
  }
  if (input.userIds.length > MAX_RECIPIENTS) {
    throw new AppError(`No puedes enviar a más de ${MAX_RECIPIENTS} clientes a la vez.`, 400);
  }

  const coupon = await couponService.findByIdOrFail(input.couponId);
  if (!coupon.isActive) {
    throw new AppError("No puedes enviar un cupón desactivado. Actívalo primero.", 409);
  }
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    throw new AppError("Este cupón ya expiró. Cambia su vigencia antes de enviarlo.", 409);
  }

  const escaped = input.message ? escapeMessage(input.message) : undefined;
  const mailer = createMailer();

  // Only real customers: an id that resolves to staff, or to nothing, is
  // reported as skipped rather than silently dropped.
  const users = await User.find({ _id: { $in: input.userIds }, role: "customer" })
    .select("email firstName")
    .lean()
    .exec();
  const byId = new Map(users.map((user) => [String(user._id), user]));

  const results: SendResult[] = [];

  for (const userId of input.userIds) {
    const user = byId.get(userId);
    if (!user) {
      results.push({ userId, status: "skipped", reason: "El cliente no existe." });
      continue;
    }

    try {
      await mailer.sendCouponEmail({
        to: user.email,
        firstName: user.firstName,
        code: coupon.code,
        ...(escaped ? { message: escaped } : {}),
        ...(coupon.expiresAt ? { expiresAt: coupon.expiresAt.toISOString() } : {}),
        discountLabel: discountLabel(coupon),
      });
      results.push({ userId, email: user.email, status: "sent" });
    } catch (error) {
      logger.error({ err: error, userId, couponId: input.couponId }, "Failed to send a coupon email");
      results.push({ userId, email: user.email, status: "failed", reason: "No se pudo enviar el correo." });
    }
  }

  const outcome = summarize(results);

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "coupon.emailed" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: String(coupon._id),
    after: { code: coupon.code, ...outcome.summary },
    ip: actor.ip,
  });

  return outcome;
}

interface GenerateInput {
  userId: string;
  type: ICoupon["type"];
  percentOffBps?: number;
  amountOffCents?: number;
  maxDiscountCents?: number;
  minSubtotalCents?: number;
  expiresAt?: string;
  message?: string;
}

/**
 * Mints a one-off coupon for a single customer and emails it.
 *
 * The generated campaign is capped at **one** redemption globally, which is
 * what makes a personal code personal: the shared-code model has no notion of
 * an owner, so "solo para Ana" is expressed as "solo se puede canjear una vez"
 * rather than by a field nothing enforces. If Ana forwards it, the first
 * person to use it takes it — the same trade every printed one-time code makes.
 *
 * The name is auto-derived from the customer's own name so these don't pile up
 * in the coupon list as anonymous rows.
 */
async function generateAndSend(input: GenerateInput, actor: ActorContext): Promise<{ coupon: ICoupon }> {
  const user = await User.findOne({ _id: input.userId, role: "customer" }).select("email firstName lastName").exec();
  if (!user) {
    throw new AppError("Cliente no encontrado.", 404);
  }

  // A CSPRNG collision is vanishingly unlikely across a 32-symbol, 8-place
  // alphabet, but the code carries a unique index and retrying is cheaper than
  // handing the admin a duplicate-key error.
  let coupon: ICoupon | null = null;
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = generateCode();
    if (await Coupon.exists({ code })) continue;

    coupon = await couponService.create(
      {
        code,
        name: `Cupón para ${user.firstName} ${user.lastName}`.trim(),
        type: input.type,
        ...(input.percentOffBps !== undefined ? { percentOffBps: input.percentOffBps } : {}),
        ...(input.amountOffCents !== undefined ? { amountOffCents: input.amountOffCents } : {}),
        ...(input.maxDiscountCents !== undefined ? { maxDiscountCents: input.maxDiscountCents } : {}),
        ...(input.minSubtotalCents !== undefined ? { minSubtotalCents: input.minSubtotalCents } : {}),
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
        maxRedemptionsTotal: 1,
        maxRedemptionsPerCustomer: 1,
        isActive: true,
      },
      actor,
    );
    break;
  }

  if (!coupon) {
    throw new AppError("No se pudo generar un código único. Intenta de nuevo.", 500);
  }

  await sendExisting({ couponId: String(coupon._id), userIds: [input.userId], ...(input.message ? { message: input.message } : {}) }, actor);

  return { coupon };
}

export const couponCampaignService = { sendExisting, generateAndSend, MAX_RECIPIENTS };
