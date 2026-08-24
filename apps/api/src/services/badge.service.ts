import type { AdminBadge, AuditAction, PublicBadge } from "@bw-bikes/shared";
import { Accessory, Badge, Bike, type IBadge } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery, slugify } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";

const MODULE_NAME = "catalog.badges";
const SORTABLE_FIELDS = ["order", "label", "createdAt"] as const;

interface BadgeInput {
  label?: string;
  slug?: string;
  variant?: PublicBadge["variant"];
  order?: number;
  isActive?: boolean;
}

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

export function toPublicBadge(badge: IBadge): PublicBadge {
  return { id: String(badge._id), label: badge.label, slug: badge.slug, variant: badge.variant, order: badge.order };
}

export function toAdminBadge(badge: IBadge): AdminBadge {
  return {
    ...toPublicBadge(badge),
    isActive: badge.isActive,
    createdAt: badge.createdAt.toISOString(),
    updatedAt: badge.updatedAt.toISOString(),
  };
}

/**
 * One collection shared by both catalogs, same reasoning and shape as
 * `brand.service.ts` — a singleton engine, not a factory (no tree, no
 * per-catalog split). `remove()` checks both `Bike.badges` and
 * `Accessory.badges` for the same reason a brand's `remove()` does: a badge
 * still assigned can't disappear silently.
 */
async function assertLabelIsFree(label: string, selfId?: string): Promise<void> {
  const filter: Record<string, unknown> = { label };
  if (selfId) filter["_id"] = { $ne: selfId };

  const existing = await Badge.exists(filter);
  if (existing) {
    throw new AppError(`Ya existe un badge con la etiqueta "${label}".`, 409);
  }
}

async function findByIdOrFail(id: string): Promise<IBadge> {
  const badge = await Badge.findById(id).exec();
  if (!badge) {
    throw new AppError("Badge no encontrado.", 404);
  }
  return badge;
}

async function list(query: Record<string, unknown>, options: { publicOnly: boolean }) {
  const { page, limit, skip, sort, search } = parseListQuery(query, {
    allowedSortFields: SORTABLE_FIELDS,
    defaultSort: "order",
  });

  const filter: Record<string, unknown> = {};
  if (options.publicOnly) {
    filter["isActive"] = true;
  } else if (typeof query["isActive"] === "boolean") {
    filter["isActive"] = query["isActive"];
  }

  if (search) {
    filter["label"] = { $regex: escapeRegex(search), $options: "i" };
  }

  // `.lean()`: callers only ever map these through `toPublicBadge`/
  // `toAdminBadge`, both plain-field readers with no document methods.
  const [documents, total] = await Promise.all([
    Badge.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
    Badge.countDocuments(filter).exec(),
  ]);

  return { documents: documents as unknown as IBadge[], meta: buildMeta(total, page, limit) };
}

async function create(input: BadgeInput, actor: ActorContext): Promise<IBadge> {
  const label = input.label!;
  const slug = input.slug ?? slugify(label);

  if (!slug) {
    throw new AppError("La etiqueta no produce un slug válido. Captura el slug manualmente.", 400);
  }
  await assertLabelIsFree(label);

  const badge = await Badge.create({
    label,
    slug,
    variant: input.variant,
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
  });

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.badge_created" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: String(badge._id),
    after: { label: badge.label, variant: badge.variant },
    ip: actor.ip,
  });

  return badge;
}

async function update(id: string, input: BadgeInput, actor: ActorContext): Promise<IBadge> {
  const badge = await findByIdOrFail(id);
  const before = { label: badge.label, variant: badge.variant };

  if (input.label !== undefined && input.label !== badge.label) {
    await assertLabelIsFree(input.label, id);
    badge.label = input.label;
  }
  if (input.slug !== undefined && input.slug !== badge.slug) {
    const existing = await Badge.exists({ slug: input.slug, _id: { $ne: id } });
    if (existing) {
      throw new AppError(`Ya existe un badge con el slug "${input.slug}".`, 409);
    }
    badge.slug = input.slug;
  }

  if (input.variant !== undefined) badge.variant = input.variant;
  if (input.order !== undefined) badge.order = input.order;
  if (input.isActive !== undefined) badge.isActive = input.isActive;

  await badge.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.badge_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before,
    after: { label: badge.label, variant: badge.variant },
    ip: actor.ip,
  });

  return badge;
}

/** Real deletion, but only when no product (either catalog) still carries it — same actionable-409 shape as `brand.service.ts`'s `remove()`. */
async function remove(id: string, actor: ActorContext): Promise<void> {
  const badge = await findByIdOrFail(id);

  const [bikeCount, accessoryCount] = await Promise.all([
    Bike.countDocuments({ badges: badge._id }).exec(),
    Accessory.countDocuments({ badges: badge._id }).exec(),
  ]);
  const productCount = bikeCount + accessoryCount;

  if (productCount > 0) {
    throw new AppError(
      `No se puede eliminar el badge porque está asignado a ${productCount} producto(s). Quítalo de esos productos primero.`,
      409,
    );
  }

  await badge.deleteOne();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.badge_deleted" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before: { label: badge.label },
    ip: actor.ip,
  });
}

export const badgeService = { list, findByIdOrFail, create, update, remove };
