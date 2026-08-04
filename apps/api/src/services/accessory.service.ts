import type { AuditAction, ProductVariant, PublicAccessory, SpecGroup } from "@bw-bikes/shared";
import { CURRENCY } from "@bw-bikes/shared";
import { Types } from "mongoose";
import { Accessory, AccessoryCategory, type IAccessory } from "../models/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { toPublicCategory } from "./category.service.js";
import { type ActorContext, createProductService } from "./product.service.js";

const MODULE_NAME = "catalog.accessories";

const base = createProductService<IAccessory>(Accessory, {
  moduleName: MODULE_NAME,
  categoryModel: AccessoryCategory,
  entityLabel: "Accesorio",
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
}

/** Storefront DTO — same contract as `toPublicBike`, minus the bike-only fields. */
export function toPublicAccessory(accessory: IAccessory): PublicAccessory {
  const category = accessory.populated("category")
    ? toPublicCategory(accessory.category as unknown as Parameters<typeof toPublicCategory>[0])
    : undefined;

  return {
    id: String(accessory._id),
    name: accessory.name,
    slug: accessory.slug,
    brand: accessory.brand,
    category: category ?? { id: String(accessory.category), name: "", slug: "", parent: null, order: 0 },
    description: accessory.description,
    price: accessory.price,
    ...(accessory.compareAtPrice !== undefined ? { compareAtPrice: accessory.compareAtPrice } : {}),
    currency: CURRENCY,
    variants: accessory.variants.filter((variant) => variant.isActive),
    specGroups: [...accessory.specGroups].sort((a, b) => a.order - b.order),
    gallery: [...accessory.gallery].sort((a, b) => a.order - b.order),
  };
}

async function create(input: AccessoryInput, actor: ActorContext): Promise<IAccessory> {
  const name = input.name!;
  const slug = base.resolveSlug(name, input.slug);

  await base.assertSlugIsFree(slug);
  await base.assertCategoryExists(input.category!);

  const variants = input.variants ?? [];
  base.assertVariantSkusAreUnique(variants);

  const accessory = await Accessory.create({
    name,
    slug,
    brand: input.brand,
    category: new Types.ObjectId(input.category),
    description: input.description,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    variants,
    specGroups: input.specGroups ?? [],
    gallery: [],
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

  return accessory;
}

async function update(id: string, input: AccessoryInput, actor: ActorContext): Promise<IAccessory> {
  const accessory = await base.findByIdOrFail(id);
  const before = { slug: accessory.slug, price: accessory.price, variants: accessory.variants.length };

  if (input.slug !== undefined && input.slug !== accessory.slug) {
    await base.assertSlugIsFree(input.slug, id);
    accessory.slug = input.slug;
  }
  if (input.category !== undefined) {
    await base.assertCategoryExists(input.category);
    accessory.category = new Types.ObjectId(input.category);
  }
  if (input.variants !== undefined) {
    base.assertVariantSkusAreUnique(input.variants);
    accessory.variants = input.variants;
  }

  if (input.name !== undefined) accessory.name = input.name;
  if (input.brand !== undefined) accessory.brand = input.brand;
  if (input.description !== undefined) accessory.description = input.description;
  if (input.price !== undefined) accessory.price = input.price;
  if (input.compareAtPrice !== undefined) accessory.compareAtPrice = input.compareAtPrice;
  if (input.specGroups !== undefined) accessory.specGroups = input.specGroups;

  await accessory.save();

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

  return accessory;
}

export const accessoryService = { ...base, create, update };
