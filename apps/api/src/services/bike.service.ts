import type { AdminBike, AuditAction, PublicBike, ProductVariant } from "@bw-bikes/shared";
import { CURRENCY } from "@bw-bikes/shared";
import { Types } from "mongoose";
import { Accessory, Bike, BikeCategory, type IBike } from "../models/index.js";
import { AppError } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { toPublicBadge } from "./badge.service.js";
import { toPublicBrand } from "./brand.service.js";
import { toPublicCategory } from "./category.service.js";
import { toPublicAccessory } from "./accessory.service.js";
import { type ActorContext, createProductService } from "./product.service.js";
import { learnSpecTemplates } from "./spec-template.service.js";

const MODULE_NAME = "catalog.bikes";

const base = createProductService<IBike>(Bike, {
  moduleName: MODULE_NAME,
  categoryModel: BikeCategory,
  entityLabel: "Bicicleta",
  itemType: "bike",
});

export interface BikeInput {
  name?: string;
  slug?: string;
  brand?: string;
  category?: string;
  shortDescription?: string;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  variants?: ProductVariant[];
  specGroups?: PublicBike["specGroups"];
  relatedAccessories?: string[];
  badges?: string[];
}

/**
 * Cross-sell is curated by hand, so the ids are validated against the
 * accessory catalog before they're stored — a dangling reference would render
 * as an empty suggestion block on the PDP with no clue why.
 */
async function assertAccessoriesExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const found = await Accessory.countDocuments({ _id: { $in: ids } }).exec();
  if (found !== ids.length) {
    throw new AppError("Uno o más accesorios sugeridos no existen.", 404);
  }
}

/**
 * The storefront DTO. Built here rather than by each controller so there is
 * exactly one definition of what the public sees — a field the UI doesn't
 * render but the API still ships is a leak, not a convenience
 * (ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"Payload consciente del rol").
 * Internal fields (`isActive`, `archivedAt`, timestamps) are absent by
 * construction, not filtered out downstream.
 */
export function toPublicBike(bike: IBike): PublicBike {
  const category = bike.populated("category")
    ? toPublicCategory(bike.category as unknown as Parameters<typeof toPublicCategory>[0])
    : undefined;
  const brand = bike.populated("brand")
    ? toPublicBrand(bike.brand as unknown as Parameters<typeof toPublicBrand>[0])
    : undefined;

  return {
    id: String(bike._id),
    name: bike.name,
    slug: bike.slug,
    brand: brand ?? { id: String(bike.brand), name: "", slug: "", order: 0 },
    category: category ?? { id: String(bike.category), name: "", slug: "", parent: null, order: 0 },
    badges: bike.populated("badges")
      ? (bike.badges as unknown as Parameters<typeof toPublicBadge>[0][]).map(toPublicBadge)
      : [],
    shortDescription: bike.shortDescription,
    description: bike.description,
    price: bike.price,
    ...(bike.compareAtPrice !== undefined ? { compareAtPrice: bike.compareAtPrice } : {}),
    currency: CURRENCY,
    variants: bike.variants.filter((variant) => variant.isActive),
    specGroups: [...bike.specGroups].sort((a, b) => a.order - b.order),
    gallery: [...bike.gallery].sort((a, b) => a.order - b.order),
    relatedAccessories: bike.populated("relatedAccessories")
      ? (bike.relatedAccessories as unknown as Parameters<typeof toPublicAccessory>[0][]).map(toPublicAccessory)
      : [],
  };
}

/**
 * The admin DTO. Unlike `toPublicBike` it doesn't filter `variants` to
 * `isActive` — the admin has to be able to re-enable one it turned off — and
 * it carries the internal fields (`isActive`, `archivedAt`, timestamps) the
 * storefront never sees. Its `relatedAccessories` resolves the same way
 * `toPublicBike`'s does (falls back to `[]` when the ref isn't populated).
 */
export function toAdminBike(bike: IBike): AdminBike {
  const category = bike.populated("category")
    ? toPublicCategory(bike.category as unknown as Parameters<typeof toPublicCategory>[0])
    : undefined;
  const brand = bike.populated("brand")
    ? toPublicBrand(bike.brand as unknown as Parameters<typeof toPublicBrand>[0])
    : undefined;

  return {
    id: String(bike._id),
    name: bike.name,
    slug: bike.slug,
    brand: brand ?? { id: String(bike.brand), name: "", slug: "", order: 0 },
    category: category ?? { id: String(bike.category), name: "", slug: "", parent: null, order: 0 },
    badges: bike.populated("badges")
      ? (bike.badges as unknown as Parameters<typeof toPublicBadge>[0][]).map(toPublicBadge)
      : [],
    shortDescription: bike.shortDescription,
    description: bike.description,
    price: bike.price,
    ...(bike.compareAtPrice !== undefined ? { compareAtPrice: bike.compareAtPrice } : {}),
    currency: CURRENCY,
    variants: bike.variants,
    specGroups: [...bike.specGroups].sort((a, b) => a.order - b.order),
    gallery: [...bike.gallery].sort((a, b) => a.order - b.order),
    relatedAccessories: bike.populated("relatedAccessories")
      ? (bike.relatedAccessories as unknown as Parameters<typeof toPublicAccessory>[0][]).map(toPublicAccessory)
      : [],
    isActive: bike.isActive,
    archivedAt: bike.archivedAt ? bike.archivedAt.toISOString() : null,
    createdAt: bike.createdAt.toISOString(),
    updatedAt: bike.updatedAt.toISOString(),
  };
}

async function create(input: BikeInput, actor: ActorContext): Promise<IBike> {
  const name = input.name!;
  const slug = base.resolveSlug(name, input.slug);

  await base.assertSlugIsFree(slug);
  await base.assertCategoryExists(input.category!);
  await base.assertBrandExists(input.brand!);

  const variants = input.variants ?? [];
  base.assertVariantSkusAreUnique(variants);

  const relatedAccessories = input.relatedAccessories ?? [];
  await assertAccessoriesExist(relatedAccessories);

  const badges = input.badges ?? [];
  await base.assertBadgesExist(badges);

  // Explicit field list — never `{...input}`. `isActive`/`archivedAt` are
  // server-owned and can't be set at creation.
  const bike = await Bike.create({
    name,
    slug,
    brand: new Types.ObjectId(input.brand),
    category: new Types.ObjectId(input.category),
    shortDescription: input.shortDescription,
    description: input.description,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    variants,
    specGroups: input.specGroups ?? [],
    gallery: [],
    relatedAccessories: relatedAccessories.map((id) => new Types.ObjectId(id)),
    badges: badges.map((id) => new Types.ObjectId(id)),
  });

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.product_created" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: String(bike._id),
    after: { slug: bike.slug, variants: bike.variants.length },
    ip: actor.ip,
  });

  // The sheet can ride along on create too (see `ProductEditor.tsx`'s own
  // doc comment) — learn from it here, same best-effort discipline as
  // `replaceSpecGroups`.
  if (input.specGroups && input.specGroups.length > 0) await learnSpecTemplates(input.specGroups);

  return bike;
}

async function update(id: string, input: BikeInput, actor: ActorContext): Promise<IBike> {
  const bike = await base.findByIdOrFail(id);
  const before = { slug: bike.slug, price: bike.price, variants: bike.variants.length };

  if (input.slug !== undefined && input.slug !== bike.slug) {
    await base.assertSlugIsFree(input.slug, id);
    bike.slug = input.slug;
  }
  if (input.category !== undefined) {
    await base.assertCategoryExists(input.category);
    bike.category = new Types.ObjectId(input.category);
  }
  if (input.brand !== undefined) {
    await base.assertBrandExists(input.brand);
    bike.brand = new Types.ObjectId(input.brand);
  }
  if (input.variants !== undefined) {
    base.assertVariantSkusAreUnique(input.variants);
    bike.variants = input.variants;
  }
  if (input.relatedAccessories !== undefined) {
    await assertAccessoriesExist(input.relatedAccessories);
    bike.relatedAccessories = input.relatedAccessories.map((accessoryId) => new Types.ObjectId(accessoryId));
  }
  if (input.badges !== undefined) {
    await base.assertBadgesExist(input.badges);
    bike.badges = input.badges.map((badgeId) => new Types.ObjectId(badgeId));
  }

  if (input.name !== undefined) bike.name = input.name;
  if (input.shortDescription !== undefined) bike.shortDescription = input.shortDescription;
  if (input.description !== undefined) bike.description = input.description;
  if (input.price !== undefined) bike.price = input.price;
  if (input.compareAtPrice !== undefined) bike.compareAtPrice = input.compareAtPrice;
  if (input.specGroups !== undefined) bike.specGroups = input.specGroups;

  await bike.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.product_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before,
    after: { slug: bike.slug, price: bike.price, variants: bike.variants.length },
    ip: actor.ip,
  });

  return bike;
}

/**
 * The PDP needs the cross-sell block resolved, which a plain `getBySlug`
 * doesn't populate — `badges` is already filtered to active-only by the base
 * `getBySlug` itself (see `product.service.ts`'s `badgesPopulateOption`).
 */
async function getPublicBySlug(slug: string): Promise<IBike> {
  const bike = await base.getBySlug(slug, { publicOnly: true });
  await bike.populate({ path: "relatedAccessories", match: { isActive: true, archivedAt: null } });
  return bike;
}

/**
 * The editor needs the cross-sell picker resolved too — but with **no**
 * visibility filter, unlike `getPublicBySlug`. An accessory the admin
 * archived after curating it as a suggestion must still show in the editor
 * (so it can be removed deliberately), not vanish from the payload as if the
 * reference had silently broken.
 */
async function getAdminById(id: string): Promise<IBike> {
  const bike = await base.getById(id);
  await bike.populate("relatedAccessories");
  return bike;
}

export const bikeService = { ...base, create, update, getPublicBySlug, getAdminById };
