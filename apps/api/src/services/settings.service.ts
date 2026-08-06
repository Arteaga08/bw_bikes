import type { AdminSettings, AuditAction, SettingsSectionName, SettingsSections } from "@bw-bikes/shared";
import { SETTINGS_DEFAULTS } from "../config/settings.defaults.js";
import type { ISettings } from "../models/index.js";
import { Settings, SETTINGS_SINGLETON_KEY } from "../models/index.js";
import { AppError } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";

const MODULE_NAME = "settings";

/**
 * How long an in-process read is trusted before the next `get()` re-queries
 * Mongo. Invalidated immediately on a local write (`updateSection`), so the
 * request that just wrote always sees its own change; the window only
 * matters across **instances** — with more than one API process, a change
 * made on one propagates to the others within this many milliseconds.
 */
const CACHE_TTL_MS = 60_000;

/** One audit action per section, matching the granularity of the write itself. */
const SECTION_AUDIT_ACTIONS: Record<SettingsSectionName, AuditAction> = {
  inventory: "settings.inventory_updated",
  orders: "settings.orders_updated",
  pricing: "settings.pricing_updated",
  shipping: "settings.shipping_updated",
  applications: "settings.applications_updated",
  jobs: "settings.jobs_updated",
};

export interface SettingsActor {
  actorType: "user" | "system";
  actorId?: string | undefined;
  ip?: string | undefined;
}

let cachedSnapshot: AdminSettings | undefined;
let cachedAt = 0;
/** Collapses concurrent misses into one Mongo round trip instead of N. */
let pendingFetch: Promise<AdminSettings> | undefined;

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function toAdminSettings(doc: ISettings): AdminSettings {
  return {
    inventory: {
      stockReservationTtlMinutes: doc.inventory.stockReservationTtlMinutes,
      reservationRetentionDays: doc.inventory.reservationRetentionDays,
    },
    orders: {
      orderPaymentTtlMinutes: doc.orders.orderPaymentTtlMinutes,
      orderAuthAlertHours: doc.orders.orderAuthAlertHours,
      orderAuthCancelHours: doc.orders.orderAuthCancelHours,
      paymentReconciliationAfterMinutes: doc.orders.paymentReconciliationAfterMinutes,
      requestThreeDSecure: doc.orders.requestThreeDSecure,
    },
    pricing: { taxRateBps: doc.pricing.taxRateBps },
    shipping: {
      accessoryFlatCents: doc.shipping.accessoryFlatCents,
      freeShippingThresholdCents: doc.shipping.freeShippingThresholdCents,
    },
    applications: { cooldownDays: doc.applications.cooldownDays },
    jobs: {
      reservationReaperIntervalMs: doc.jobs.reservationReaperIntervalMs,
      orderAuthSweepIntervalMs: doc.jobs.orderAuthSweepIntervalMs,
      paymentReconciliationIntervalMs: doc.jobs.paymentReconciliationIntervalMs,
    },
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Creates the singleton on first touch — no seed script required — and
 * hands back the live Mongoose document (not the DTO), so callers that need
 * to mutate a section and `.save()` it get real change tracking.
 *
 * The upsert is the primary defence against a create-create race; the
 * unique index on `key` is the backstop if two requests still interleave
 * around it, in which case the loser here simply re-reads what the winner
 * created.
 */
async function findOrCreateDocument(): Promise<ISettings> {
  try {
    const doc = await Settings.findOneAndUpdate(
      { key: SETTINGS_SINGLETON_KEY },
      { $setOnInsert: { key: SETTINGS_SINGLETON_KEY, ...SETTINGS_DEFAULTS } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
    if (!doc) throw new AppError("No se pudo inicializar la configuración.", 500);
    return doc;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const existing = await Settings.findOne({ key: SETTINGS_SINGLETON_KEY }).exec();
    if (!existing) throw error;
    return existing;
  }
}

/**
 * Every threshold in one read. Cached in-process with a short TTL and a
 * single in-flight promise, so a burst of requests (a checkout, a cart
 * preview, and the pricing engine all resolving concurrently) costs one
 * Mongo round trip, not several.
 */
async function get(): Promise<AdminSettings> {
  const now = Date.now();
  if (cachedSnapshot && now - cachedAt < CACHE_TTL_MS) return cachedSnapshot;
  if (pendingFetch) return pendingFetch;

  pendingFetch = findOrCreateDocument()
    .then((doc) => {
      const snapshot = toAdminSettings(doc);
      cachedSnapshot = snapshot;
      cachedAt = Date.now();
      return snapshot;
    })
    .finally(() => {
      pendingFetch = undefined;
    });

  return pendingFetch;
}

/**
 * Replaces one section's fields, and only that section's fields.
 *
 * The write goes through `document.save()`, not `findOneAndUpdate` — that is
 * what makes this both correct and race-safe at once. Mongoose's `save()`
 * sends a targeted `$set` for the paths actually modified in memory, so two
 * concurrent calls editing two different sections (`shipping` and `orders`,
 * say) each touch only their own path and cannot clobber one another
 * regardless of which commits first. `findOneAndUpdate` with a literal
 * `{ $set: { [section]: values } }` would do the same for the *data*, but it
 * would also skip `settingsSchema`'s `pre("validate")` hook — Mongoose only
 * runs document middleware on `save()`/`validate()`, never on
 * `findOneAndUpdate`, even with `runValidators: true`. The
 * `orderAuthAlertHours < orderAuthCancelHours` invariant needs that hook, so
 * `save()` is the one write path that keeps both properties true.
 */
async function updateSection<K extends SettingsSectionName>(
  section: K,
  values: SettingsSections[K],
  actor: SettingsActor,
): Promise<AdminSettings> {
  const doc = await findOrCreateDocument();
  const before = toAdminSettings(doc)[section];

  Object.assign(doc[section], values);
  await doc.save();

  const snapshot = toAdminSettings(doc);
  cachedSnapshot = snapshot;
  cachedAt = Date.now();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: actor.actorType,
    action: SECTION_AUDIT_ACTIONS[section],
    module: MODULE_NAME,
    before,
    after: values,
    ip: actor.ip,
  });

  return snapshot;
}

/** Test-only: forces the next `get()` to re-read Mongo instead of trusting the in-process cache. */
export function resetSettingsCache(): void {
  cachedSnapshot = undefined;
  cachedAt = 0;
  pendingFetch = undefined;
}

export const settingsService = { get, updateSection };
