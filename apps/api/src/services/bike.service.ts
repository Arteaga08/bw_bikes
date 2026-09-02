import type { AdminBike, AuditAction, CategoryImage, PublicBike, ProductVariant, SummaryRow } from "@bw-bikes/shared";
import { CURRENCY } from "@bw-bikes/shared";
import { Types } from "mongoose";
import { Accessory, Bike, BikeCategory, type IBike } from "../models/index.js";
import { AppError, withOptionalTransaction } from "../utils/index.js";
import { deleteImage } from "./storage/storage.service.js";
import { recordAuditLog } from "./audit-log.service.js";
import { toPublicBadge } from "./badge.service.js";
import { toPublicBrand } from "./brand.service.js";
import { toPublicCategory } from "./category.service.js";
import { toPublicAccessory } from "./accessory.service.js";
import { inventoryService } from "./inventory.service.js";
import { type ActorContext, createProductService } from "./product.service.js";
import { bikeSizeTemplateService } from "./bike-size-template.service.js";
import { learnColorTemplates } from "./color-template.service.js";
import { learnSpecTemplates } from "./spec-template.service.js";
import { toPublicSpecGroups } from "./spec-groups.js";

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
  modelYear?: number;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  variants?: ProductVariant[];
  summary?: SummaryRow[];
  specGroups?: PublicBike["specGroups"];
  relatedAccessories?: string[];
  badges?: string[];
  isNewArrival?: boolean;
  isCustomerFavorite?: boolean;
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
    category: category ?? { id: String(bike.category), name: "", slug: "", parent: null, order: 0, usesSizes: false },
    badges: bike.populated("badges")
      ? (bike.badges as unknown as Parameters<typeof toPublicBadge>[0][]).map(toPublicBadge)
      : [],
    shortDescription: bike.shortDescription,
    ...(bike.modelYear !== undefined ? { modelYear: bike.modelYear } : {}),
    description: bike.description,
    price: bike.price,
    ...(bike.compareAtPrice !== undefined ? { compareAtPrice: bike.compareAtPrice } : {}),
    currency: CURRENCY,
    variants: bike.variants.filter((variant) => variant.isActive),
    summary: [...bike.summary].sort((a, b) => a.order - b.order),
    specGroups: toPublicSpecGroups(bike.specGroups),
    ...(bike.geometryImage ? { geometryImage: bike.geometryImage } : {}),
    gallery: [...bike.gallery].sort((a, b) => a.order - b.order),
    relatedAccessories: bike.populated("relatedAccessories")
      ? (bike.relatedAccessories as unknown as Parameters<typeof toPublicAccessory>[0][]).map(toPublicAccessory)
      : [],
    // `isNewArrival`/`isCustomerFavorite` stay out on purpose — the storefront
    // filters *by* them (`?isNewArrival=true`, `?isCustomerFavorite=true`) but
    // never paints them, so shipping them would be a leak.
    // `createdAt` does ship: the home's "Novedades" rail merges bikes and
    // accessories into one list and needs a date to order them by.
    createdAt: bike.createdAt.toISOString(),
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
    category: category ?? { id: String(bike.category), name: "", slug: "", parent: null, order: 0, usesSizes: false },
    badges: bike.populated("badges")
      ? (bike.badges as unknown as Parameters<typeof toPublicBadge>[0][]).map(toPublicBadge)
      : [],
    shortDescription: bike.shortDescription,
    ...(bike.modelYear !== undefined ? { modelYear: bike.modelYear } : {}),
    description: bike.description,
    price: bike.price,
    ...(bike.compareAtPrice !== undefined ? { compareAtPrice: bike.compareAtPrice } : {}),
    currency: CURRENCY,
    variants: bike.variants,
    summary: [...bike.summary].sort((a, b) => a.order - b.order),
    // Unfiltered, unlike `toPublicBike`'s: the editor has to show a hidden
    // apartado to be able to turn it back on.
    specGroups: [...bike.specGroups].sort((a, b) => a.order - b.order),
    ...(bike.geometryImage ? { geometryImage: bike.geometryImage } : {}),
    gallery: [...bike.gallery].sort((a, b) => a.order - b.order),
    relatedAccessories: bike.populated("relatedAccessories")
      ? (bike.relatedAccessories as unknown as Parameters<typeof toPublicAccessory>[0][]).map(toPublicAccessory)
      : [],
    isNewArrival: bike.isNewArrival,
    isCustomerFavorite: bike.isCustomerFavorite,
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

  // Two collections now, when any variant carries `initialStock` — the
  // product document and one `InventoryItem` per `in_stock` row — so both
  // writes go inside a transaction: a failure seeding stock must not leave a
  // bike saved with no inventory behind it, and vice versa. `recordAuditLog`
  // stays outside on purpose, same discipline as everywhere else in this
  // codebase — it never runs inside the transaction it's auditing.
  let seededInventory: Awaited<ReturnType<typeof inventoryService.seedInitialStock>> = [];

  const bike = await withOptionalTransaction(async (session) => {
    // Explicit field list — never `{...input}`. `isActive`/`archivedAt` are
    // server-owned and can't be set at creation.
    const [created] = await Bike.create(
      [
        {
          name,
          slug,
          brand: new Types.ObjectId(input.brand),
          category: new Types.ObjectId(input.category),
          shortDescription: input.shortDescription,
          modelYear: input.modelYear,
          description: input.description,
          price: input.price,
          compareAtPrice: input.compareAtPrice,
          variants,
          summary: input.summary ?? [],
          specGroups: input.specGroups ?? [],
          // Both image fields are server-owned and set only through their own
          // endpoints, never from a create payload.
          geometryImage: null,
          gallery: [],
          relatedAccessories: relatedAccessories.map((id) => new Types.ObjectId(id)),
          badges: badges.map((id) => new Types.ObjectId(id)),
          isNewArrival: input.isNewArrival ?? false,
          isCustomerFavorite: input.isCustomerFavorite ?? false,
        },
      ],
      { session },
    );

    seededInventory = await inventoryService.seedInitialStock(
      "bike",
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
    targetId: String(bike._id),
    after: { slug: bike.slug, variants: bike.variants.length },
    ip: actor.ip,
  });

  for (const item of seededInventory) {
    await inventoryService.recordItemCreatedAudit(item, actor);
  }

  // The sheet can ride along on create too (see `ProductEditor.tsx`'s own
  // doc comment) — learn from it here, same best-effort discipline as
  // `replaceSpecGroups`.
  if (input.specGroups && input.specGroups.length > 0) await learnSpecTemplates(input.specGroups);
  if (variants.length > 0) await bikeSizeTemplateService.learnSizeTemplates(variants);
  if (variants.length > 0) await learnColorTemplates(variants);

  return bike;
}

async function update(id: string, input: BikeInput, actor: ActorContext): Promise<IBike> {
  const bike = await base.findByIdOrFail(id);
  const before = { slug: bike.slug, price: bike.price, variants: bike.variants.length };
  // Snapshotted before anything below mutates `bike.variants` — the only way
  // to tell a brand-new row (seed its inventory) from an edited existing one
  // (never re-seed; see `partitionNewVariants`).
  const previousSkus = new Set(bike.variants.map((variant) => variant.sku));

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
  let newVariants: ProductVariant[] = [];
  if (input.variants !== undefined) {
    base.assertVariantSkusAreUnique(input.variants);
    newVariants = base.partitionNewVariants(previousSkus, input.variants);
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
  if (input.modelYear !== undefined) bike.modelYear = input.modelYear;
  if (input.description !== undefined) bike.description = input.description;
  if (input.price !== undefined) bike.price = input.price;
  if (input.compareAtPrice !== undefined) bike.compareAtPrice = input.compareAtPrice;
  if (input.summary !== undefined) bike.summary = input.summary;
  if (input.specGroups !== undefined) bike.specGroups = input.specGroups;
  if (input.isNewArrival !== undefined) bike.isNewArrival = input.isNewArrival;
  if (input.isCustomerFavorite !== undefined) bike.isCustomerFavorite = input.isCustomerFavorite;

  // Same atomicity discipline as `create()`: once a PATCH can also write
  // `InventoryItem` rows (for a brand-new `in_stock` variant), the product
  // save and the inventory seed must succeed or fail together.
  let seededInventory: Awaited<ReturnType<typeof inventoryService.seedInitialStock>> = [];

  await withOptionalTransaction(async (session) => {
    await bike.save({ session });
    seededInventory = await inventoryService.seedInitialStock("bike", bike._id as Types.ObjectId, newVariants, session);
  });

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

  for (const item of seededInventory) {
    await inventoryService.recordItemCreatedAudit(item, actor);
  }

  // Unlike `specGroups` (a separate `PUT .../spec-groups`), variants are part
  // of this same PATCH — so, unlike the sheet, learning has to happen here
  // too, not just on create.
  if (input.variants !== undefined && input.variants.length > 0) {
    await bikeSizeTemplateService.learnSizeTemplates(input.variants);
    await learnColorTemplates(input.variants);
  }

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

/**
 * The geometry chart (M10.6). Same ordering discipline as `brand.service.ts`'s
 * `setLogo`: save first, delete the old remote asset only after — a failed
 * remote delete orphans an asset in Cloudinary (recoverable), the reverse
 * order would leave the bike pointing at a URL that 404s.
 */
async function setGeometryImage(id: string, image: CategoryImage, actor: ActorContext): Promise<IBike> {
  const bike = await base.findByIdOrFail(id);
  const previousPublicId = bike.geometryImage?.publicId;

  bike.geometryImage = image;
  await bike.save();

  if (previousPublicId) {
    await deleteImage(previousPublicId);
  }

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.geometry_image_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    after: { publicId: image.publicId },
    ip: actor.ip,
  });

  return bike;
}

async function removeGeometryImage(id: string, actor: ActorContext): Promise<IBike> {
  const bike = await base.findByIdOrFail(id);
  if (!bike.geometryImage) {
    throw new AppError("La bicicleta no tiene imagen de geometría.", 409);
  }
  const { publicId } = bike.geometryImage;

  bike.geometryImage = null;
  await bike.save();

  await deleteImage(publicId);

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.geometry_image_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before: { publicId },
    ip: actor.ip,
  });

  return bike;
}

export const bikeService = {
  ...base,
  create,
  update,
  getPublicBySlug,
  getAdminById,
  setGeometryImage,
  removeGeometryImage,
};
