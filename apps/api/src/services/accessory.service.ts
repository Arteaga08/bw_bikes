import type { AdminAccessory, AuditAction, ProductVariant, PublicAccessory, SpecGroup } from "@bw-bikes/shared";
import { CURRENCY } from "@bw-bikes/shared";
import { Types } from "mongoose";
import { Accessory, AccessoryCategory, type IAccessory } from "../models/index.js";
import { withOptionalTransaction } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { toPublicBadge } from "./badge.service.js";
import { toPublicBrand } from "./brand.service.js";
import { toPublicCategory } from "./category.service.js";
import { inventoryService } from "./inventory.service.js";
import { type ActorContext, createProductService } from "./product.service.js";
import { accessorySizeTemplateService } from "./accessory-size-template.service.js";
import { learnColorTemplates } from "./color-template.service.js";
import { learnSpecTemplates } from "./spec-template.service.js";

const MODULE_NAME = "catalog.accessories";

const base = createProductService<IAccessory>(Accessory, {
  moduleName: MODULE_NAME,
  categoryModel: AccessoryCategory,
  entityLabel: "Accesorio",
  itemType: "accessory",
});

export interface AccessoryInput {
  name?: string;
  slug?: string;
  brand?: string;
  category?: string;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  variants?: ProductVariant[];
  specGroups?: SpecGroup[];
  badges?: string[];
  isNewArrival?: boolean;
  isCustomerFavorite?: boolean;
}

/** Storefront DTO — same contract as `toPublicBike`, minus the bike-only fields. */
export function toPublicAccessory(accessory: IAccessory): PublicAccessory {
  const category = accessory.populated("category")
    ? toPublicCategory(accessory.category as unknown as Parameters<typeof toPublicCategory>[0])
    : undefined;
  const brand = accessory.populated("brand")
    ? toPublicBrand(accessory.brand as unknown as Parameters<typeof toPublicBrand>[0])
    : undefined;

  return {
    id: String(accessory._id),
    name: accessory.name,
    slug: accessory.slug,
    brand: brand ?? { id: String(accessory.brand), name: "", slug: "", order: 0 },
    category: category ?? { id: String(accessory.category), name: "", slug: "", parent: null, order: 0, usesSizes: false },
    badges: accessory.populated("badges")
      ? (accessory.badges as unknown as Parameters<typeof toPublicBadge>[0][]).map(toPublicBadge)
      : [],
    description: accessory.description,
    price: accessory.price,
    ...(accessory.compareAtPrice !== undefined ? { compareAtPrice: accessory.compareAtPrice } : {}),
    currency: CURRENCY,
    variants: accessory.variants.filter((variant) => variant.isActive),
    specGroups: [...accessory.specGroups].sort((a, b) => a.order - b.order),
    gallery: [...accessory.gallery].sort((a, b) => a.order - b.order),
    // `isNewArrival`/`isCustomerFavorite` omitted, `createdAt` shipped — see `toPublicBike` for why.
    createdAt: accessory.createdAt.toISOString(),
  };
}

/** The admin DTO — same contract as `toAdminBike`, minus the bike-only fields, and `variants` unfiltered. */
export function toAdminAccessory(accessory: IAccessory): AdminAccessory {
  const category = accessory.populated("category")
    ? toPublicCategory(accessory.category as unknown as Parameters<typeof toPublicCategory>[0])
    : undefined;
  const brand = accessory.populated("brand")
    ? toPublicBrand(accessory.brand as unknown as Parameters<typeof toPublicBrand>[0])
    : undefined;

  return {
    id: String(accessory._id),
    name: accessory.name,
    slug: accessory.slug,
    brand: brand ?? { id: String(accessory.brand), name: "", slug: "", order: 0 },
    category: category ?? { id: String(accessory.category), name: "", slug: "", parent: null, order: 0, usesSizes: false },
    badges: accessory.populated("badges")
      ? (accessory.badges as unknown as Parameters<typeof toPublicBadge>[0][]).map(toPublicBadge)
      : [],
    description: accessory.description,
    price: accessory.price,
    ...(accessory.compareAtPrice !== undefined ? { compareAtPrice: accessory.compareAtPrice } : {}),
    currency: CURRENCY,
    variants: accessory.variants,
    specGroups: [...accessory.specGroups].sort((a, b) => a.order - b.order),
    gallery: [...accessory.gallery].sort((a, b) => a.order - b.order),
    isNewArrival: accessory.isNewArrival,
    isCustomerFavorite: accessory.isCustomerFavorite,
    isActive: accessory.isActive,
    archivedAt: accessory.archivedAt ? accessory.archivedAt.toISOString() : null,
    createdAt: accessory.createdAt.toISOString(),
    updatedAt: accessory.updatedAt.toISOString(),
  };
}

async function create(input: AccessoryInput, actor: ActorContext): Promise<IAccessory> {
  const name = input.name!;
  const slug = base.resolveSlug(name, input.slug);

  await base.assertSlugIsFree(slug);
  await base.assertCategoryExists(input.category!);
  await base.assertBrandExists(input.brand!);

  const variants = input.variants ?? [];
  base.assertVariantSkusAreUnique(variants);

  const badges = input.badges ?? [];
  await base.assertBadgesExist(badges);

  // Same reasoning as `bike.service.ts`'s `create`: two collections when a
  // variant carries `initialStock`, so both writes go inside a transaction.
  let seededInventory: Awaited<ReturnType<typeof inventoryService.seedInitialStock>> = [];

  const accessory = await withOptionalTransaction(async (session) => {
    const [created] = await Accessory.create(
      [
        {
          name,
          slug,
          brand: new Types.ObjectId(input.brand),
          category: new Types.ObjectId(input.category),
          description: input.description,
          price: input.price,
          compareAtPrice: input.compareAtPrice,
          variants,
          specGroups: input.specGroups ?? [],
          gallery: [],
          badges: badges.map((id) => new Types.ObjectId(id)),
          isNewArrival: input.isNewArrival ?? false,
          isCustomerFavorite: input.isCustomerFavorite ?? false,
        },
      ],
      { session },
    );

    seededInventory = await inventoryService.seedInitialStock(
      "accessory",
      created!._id as Types.ObjectId,
      variants,
      session,
    );

    return created!;
  });

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.product_created" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: String(accessory._id),
    after: { slug: accessory.slug, variants: accessory.variants.length },
    ip: actor.ip,
  });

  for (const item of seededInventory) {
    await inventoryService.recordItemCreatedAudit(item, actor);
  }

  if (input.specGroups && input.specGroups.length > 0) await learnSpecTemplates(input.specGroups);
  if (variants.length > 0) await accessorySizeTemplateService.learnSizeTemplates(variants);
  if (variants.length > 0) await learnColorTemplates(variants);

  return accessory;
}

async function update(id: string, input: AccessoryInput, actor: ActorContext): Promise<IAccessory> {
  const accessory = await base.findByIdOrFail(id);
  const before = { slug: accessory.slug, price: accessory.price, variants: accessory.variants.length };
  // Snapshotted before anything below mutates `accessory.variants` — see
  // `bike.service.ts`'s `update` for the full reasoning (mirrored 1:1 here).
  const previousSkus = new Set(accessory.variants.map((variant) => variant.sku));

  if (input.slug !== undefined && input.slug !== accessory.slug) {
    await base.assertSlugIsFree(input.slug, id);
    accessory.slug = input.slug;
  }
  if (input.category !== undefined) {
    await base.assertCategoryExists(input.category);
    accessory.category = new Types.ObjectId(input.category);
  }
  if (input.brand !== undefined) {
    await base.assertBrandExists(input.brand);
    accessory.brand = new Types.ObjectId(input.brand);
  }
  let newVariants: ProductVariant[] = [];
  if (input.variants !== undefined) {
    base.assertVariantSkusAreUnique(input.variants);
    newVariants = base.partitionNewVariants(previousSkus, input.variants);
    accessory.variants = input.variants;
  }
  if (input.badges !== undefined) {
    await base.assertBadgesExist(input.badges);
    accessory.badges = input.badges.map((badgeId) => new Types.ObjectId(badgeId));
  }

  if (input.name !== undefined) accessory.name = input.name;
  if (input.description !== undefined) accessory.description = input.description;
  if (input.price !== undefined) accessory.price = input.price;
  if (input.compareAtPrice !== undefined) accessory.compareAtPrice = input.compareAtPrice;
  if (input.specGroups !== undefined) accessory.specGroups = input.specGroups;
  if (input.isNewArrival !== undefined) accessory.isNewArrival = input.isNewArrival;
  if (input.isCustomerFavorite !== undefined) accessory.isCustomerFavorite = input.isCustomerFavorite;

  let seededInventory: Awaited<ReturnType<typeof inventoryService.seedInitialStock>> = [];

  await withOptionalTransaction(async (session) => {
    await accessory.save({ session });
    seededInventory = await inventoryService.seedInitialStock(
      "accessory",
      accessory._id as Types.ObjectId,
      newVariants,
      session,
    );
  });

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.product_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before,
    after: { slug: accessory.slug, price: accessory.price, variants: accessory.variants.length },
    ip: actor.ip,
  });

  for (const item of seededInventory) {
    await inventoryService.recordItemCreatedAudit(item, actor);
  }

  // Unlike `specGroups` (a separate `PUT .../spec-groups`), variants are part
  // of this same PATCH — so, unlike the sheet, learning has to happen here
  // too, not just on create.
  if (input.variants !== undefined && input.variants.length > 0) {
    await accessorySizeTemplateService.learnSizeTemplates(input.variants);
    await learnColorTemplates(input.variants);
  }

  return accessory;
}

export const accessoryService = { ...base, create, update };
