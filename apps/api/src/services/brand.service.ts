import type { AdminBrand, AuditAction, CategoryImage, PublicBrand } from "@bw-bikes/shared";
import { Accessory, Bike, Brand, type IBrand } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery, slugify } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { deleteImage } from "./storage/storage.service.js";

const MODULE_NAME = "catalog.brands";
const SORTABLE_FIELDS = ["order", "name", "createdAt"] as const;

interface BrandInput {
  name?: string;
  slug?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
}

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

export function toPublicBrand(brand: IBrand): PublicBrand {
  return {
    id: String(brand._id),
    name: brand.name,
    slug: brand.slug,
    ...(brand.description ? { description: brand.description } : {}),
    ...(brand.logo ? { logo: brand.logo } : {}),
    order: brand.order,
  };
}

export function toAdminBrand(brand: IBrand): AdminBrand {
  return {
    ...toPublicBrand(brand),
    isActive: brand.isActive,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  };
}

/**
 * One collection shared by both catalogs (see `brand.model.ts`), so — unlike
 * `category.service.ts`, instantiated once per tree — this engine is a
 * singleton service, not a factory. `remove()` checks both `Bike` and
 * `Accessory` for the same reason a category's `remove()` checks its
 * products: a brand still referenced can't disappear silently and leave a
 * product pointing at an id that resolves to nothing.
 */
async function assertNameIsFree(name: string, selfId?: string): Promise<void> {
  const filter: Record<string, unknown> = { name };
  if (selfId) filter["_id"] = { $ne: selfId };

  const existing = await Brand.findOne(filter).exec();
  if (!existing) return;
  throw new AppError(`Ya existe una marca con el nombre "${name}".`, 409);
}

async function findByIdOrFail(id: string): Promise<IBrand> {
  const brand = await Brand.findById(id).exec();
  if (!brand) {
    throw new AppError("Marca no encontrada.", 404);
  }
  return brand;
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
    filter["$or"] = [
      { name: { $regex: escapeRegex(search), $options: "i" } },
      { slug: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }

  const [documents, total] = await Promise.all([
    Brand.find(filter).sort(sort).skip(skip).limit(limit).exec(),
    Brand.countDocuments(filter).exec(),
  ]);

  return { documents, meta: buildMeta(total, page, limit) };
}

async function getBySlug(slug: string, options: { publicOnly: boolean }): Promise<IBrand> {
  const filter: Record<string, unknown> = { slug };
  if (options.publicOnly) filter["isActive"] = true;

  const brand = await Brand.findOne(filter).exec();
  if (!brand) {
    throw new AppError("Marca no encontrada.", 404);
  }
  return brand;
}

async function create(input: BrandInput, actor: ActorContext): Promise<IBrand> {
  const name = input.name!;
  const slug = input.slug ?? slugify(name);

  if (!slug) {
    throw new AppError("El nombre no produce un slug válido. Captura el slug manualmente.", 400);
  }
  await assertNameIsFree(name);

  const brand = await Brand.create({
    name,
    slug,
    description: input.description,
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
  });

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.brand_created" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: String(brand._id),
    after: { slug: brand.slug },
    ip: actor.ip,
  });

  return brand;
}

async function update(id: string, input: BrandInput, actor: ActorContext): Promise<IBrand> {
  const brand = await findByIdOrFail(id);
  const before = { name: brand.name, slug: brand.slug };

  const nextName = input.name ?? brand.name;
  if (nextName !== brand.name) {
    await assertNameIsFree(nextName, id);
  }

  if (input.slug !== undefined && input.slug !== brand.slug) {
    const existing = await Brand.exists({ slug: input.slug, _id: { $ne: id } });
    if (existing) {
      throw new AppError(`Ya existe una marca con el slug "${input.slug}".`, 409);
    }
    brand.slug = input.slug;
  }

  if (input.name !== undefined) brand.name = input.name;
  if (input.description !== undefined) brand.description = input.description;
  if (input.order !== undefined) brand.order = input.order;
  if (input.isActive !== undefined) brand.isActive = input.isActive;

  await brand.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.brand_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before,
    after: { name: brand.name, slug: brand.slug },
    ip: actor.ip,
  });

  return brand;
}

/** Real deletion, but only when no product (either catalog) still references it — same actionable-409 shape as `category.service.ts`'s `remove()`. */
async function remove(id: string, actor: ActorContext): Promise<void> {
  const brand = await findByIdOrFail(id);

  const [bikeCount, accessoryCount] = await Promise.all([
    Bike.countDocuments({ brand: brand._id }).exec(),
    Accessory.countDocuments({ brand: brand._id }).exec(),
  ]);
  const productCount = bikeCount + accessoryCount;

  if (productCount > 0) {
    throw new AppError(
      `No se puede eliminar la marca porque tiene ${productCount} producto(s) asociado(s). Reasigna o elimina ese contenido primero.`,
      409,
    );
  }

  await brand.deleteOne();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.brand_deleted" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before: { slug: brand.slug },
    ip: actor.ip,
  });
}

/** Same ordering discipline as `category.service.ts`'s `setImage`: save first, delete the old remote asset only after — a failed remote delete orphans an asset (recoverable), the reverse order would leave the brand pointing at a URL that 404s. */
async function setLogo(id: string, logo: CategoryImage, actor: ActorContext): Promise<IBrand> {
  const brand = await findByIdOrFail(id);
  const previousPublicId = brand.logo?.publicId;

  brand.logo = logo;
  await brand.save();

  if (previousPublicId) {
    await deleteImage(previousPublicId);
  }

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.brand_logo_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    after: { publicId: logo.publicId },
    ip: actor.ip,
  });

  return brand;
}

async function removeLogo(id: string, actor: ActorContext): Promise<IBrand> {
  const brand = await findByIdOrFail(id);
  if (!brand.logo) {
    throw new AppError("La marca no tiene logo.", 409);
  }
  const publicId = brand.logo.publicId;

  brand.logo = undefined;
  await brand.save();

  await deleteImage(publicId);

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "catalog.brand_logo_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before: { publicId },
    ip: actor.ip,
  });

  return brand;
}

export const brandService = { list, getBySlug, findByIdOrFail, create, update, remove, setLogo, removeLogo };
