import type { AuditAction, BrakeType, PublicBike, ProductVariant } from "@bw-bikes/shared";
import { CURRENCY } from "@bw-bikes/shared";
import { Types } from "mongoose";
import { Accessory, Bike, BikeCategory, type IBike } from "../models/index.js";
import { AppError } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { toPublicCategory } from "./category.service.js";
import { toPublicAccessory } from "./accessory.service.js";
import { type ActorContext, createProductService } from "./product.service.js";

const MODULE_NAME = "catalog.bikes";

const base = createProductService<IBike>(Bike, {
  moduleName: MODULE_NAME,
  categoryModel: BikeCategory,
  entityLabel: "Bicicleta",
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
  brakeType?: BrakeType;
  variants?: ProductVariant[];
  specGroups?: PublicBike["specGroups"];
  relatedAccessories?: string[];
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

  return {
    id: String(bike._id),
    name: bike.name,
    slug: bike.slug,
    brand: bike.brand,
    category: category ?? { id: String(bike.category), name: "", slug: "", parent: null, order: 0 },
    shortDescription: bike.shortDescription,
    description: bike.description,
    price: bike.price,
    ...(bike.compareAtPrice !== undefined ? { compareAtPrice: bike.compareAtPrice } : {}),
    currency: CURRENCY,
    brakeType: bike.brakeType,
    variants: bike.variants.filter((variant) => variant.isActive),
    specGroups: [...bike.specGroups].sort((a, b) => a.order - b.order),
    gallery: [...bike.gallery].sort((a, b) => a.order - b.order),
    relatedAccessories: bike.populated("relatedAccessories")
      ? (bike.relatedAccessories as unknown as Parameters<typeof toPublicAccessory>[0][]).map(toPublicAccessory)
      : [],
  };
}

async function create(input: BikeInput, actor: ActorContext): Promise<IBike> {
  const name = input.name!;
  const slug = base.resolveSlug(name, input.slug);

  await base.assertSlugIsFree(slug);
  await base.assertCategoryExists(input.category!);

  const variants = input.variants ?? [];
  base.assertVariantSkusAreUnique(variants);

  const relatedAccessories = input.relatedAccessories ?? [];
  await assertAccessoriesExist(relatedAccessories);

  // Explicit field list — never `{...input}`. `isActive`/`archivedAt` are
  // server-owned and can't be set at creation.
  const bike = await Bike.create({
    name,
    slug,
    brand: input.brand,
    category: new Types.ObjectId(input.category),
    shortDescription: input.shortDescription,
    description: input.description,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    brakeType: input.brakeType,
    variants,
    specGroups: input.specGroups ?? [],
    gallery: [],
    relatedAccessories: relatedAccessories.map((id) => new Types.ObjectId(id)),
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
  if (input.variants !== undefined) {
    base.assertVariantSkusAreUnique(input.variants);
    bike.variants = input.variants;
  }
  if (input.relatedAccessories !== undefined) {
    await assertAccessoriesExist(input.relatedAccessories);
    bike.relatedAccessories = input.relatedAccessories.map((accessoryId) => new Types.ObjectId(accessoryId));
  }

  if (input.name !== undefined) bike.name = input.name;
  if (input.brand !== undefined) bike.brand = input.brand;
  if (input.shortDescription !== undefined) bike.shortDescription = input.shortDescription;
  if (input.description !== undefined) bike.description = input.description;
  if (input.price !== undefined) bike.price = input.price;
  if (input.compareAtPrice !== undefined) bike.compareAtPrice = input.compareAtPrice;
  if (input.brakeType !== undefined) bike.brakeType = input.brakeType;
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

/** The PDP needs the cross-sell block resolved, which a plain `getBySlug` doesn't populate. */
async function getPublicBySlug(slug: string): Promise<IBike> {
  const bike = await base.getBySlug(slug, { publicOnly: true });
  await bike.populate({ path: "relatedAccessories", match: { isActive: true, archivedAt: null } });
  return bike;
}

export const bikeService = { ...base, create, update, getPublicBySlug };
