import type { AuditAction, ProductImage, ProductVariant, SpecGroup } from "@bw-bikes/shared";
import type { Document, Model, Types } from "mongoose";
import { Types as MongooseTypes } from "mongoose";
import type { ICategory } from "../models/index.js";
import { MAX_GALLERY_IMAGES } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery, slugify } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { deleteImage } from "./storage/storage.service.js";

/**
 * The fields both catalogs share. `Bike` and `Accessory` remain two separate
 * entities with separate collections, category trees and endpoints — what's
 * factored out here is only the machinery every product needs regardless of
 * what it is: slug uniqueness, filtered pagination, archiving, spec sheet and
 * gallery. The parts that genuinely differ (brake type, cross-sell, short
 * description) stay in each catalog's own service.
 */
export interface ProductDocument extends Document {
  name: string;
  slug: string;
  brand: string;
  category: Types.ObjectId;
  description: string;
  price: number;
  compareAtPrice?: number;
  variants: ProductVariant[];
  specGroups: SpecGroup[];
  gallery: ProductImage[];
  isActive: boolean;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

export interface ProductServiceOptions {
  /** Labels the audit entries, e.g. `catalog.bikes`. */
  moduleName: string;
  /** The category tree this catalog belongs to, used to validate refs and expand parent filters. */
  categoryModel: Model<ICategory>;
  /** User-facing noun for 404s ("Bicicleta" / "Accesorio"). */
  entityLabel: string;
}

const SORTABLE_FIELDS = ["createdAt", "price", "name"] as const;

/** Only active, never-archived products are visible to the storefront. */
const PUBLIC_VISIBILITY = { isActive: true, archivedAt: null } as const;

export function createProductService<TDoc extends ProductDocument>(
  Product: Model<TDoc>,
  options: ProductServiceOptions,
) {
  const { moduleName, categoryModel, entityLabel } = options;

  async function findByIdOrFail(id: string): Promise<TDoc> {
    const product = await Product.findById(id).exec();
    if (!product) {
      throw new AppError(`${entityLabel} no encontrado.`, 404);
    }
    return product;
  }

  /** Complements the unique index: turns the loser of a race into a clear 409 instead of a raw 11000. */
  async function assertSlugIsFree(slug: string, selfId?: string): Promise<void> {
    const filter: Record<string, unknown> = { slug };
    if (selfId) filter["_id"] = { $ne: new MongooseTypes.ObjectId(selfId) };

    if (await Product.exists(filter)) {
      throw new AppError(`Ya existe un producto con el slug "${slug}".`, 409);
    }
  }

  /** A product may only point at a category of *its own* tree — that's why the model is injected. */
  async function assertCategoryExists(categoryId: string): Promise<void> {
    if (!(await categoryModel.exists({ _id: categoryId }))) {
      throw new AppError("La categoría indicada no existe.", 404);
    }
  }

  function resolveSlug(name: string, explicit?: string): string {
    const slug = explicit ?? slugify(name);
    if (!slug) {
      throw new AppError("El nombre no produce un slug válido. Captura el slug manualmente.", 400);
    }
    return slug;
  }

  /**
   * Duplicate SKUs inside one product would pass the collection-level unique
   * index (it indexes the array, so a document is compared against *others*)
   * while making the variant ambiguous for inventory in M4.
   */
  function assertVariantSkusAreUnique(variants: ProductVariant[]): void {
    const seen = new Set<string>();
    for (const variant of variants) {
      if (seen.has(variant.sku)) {
        throw new AppError(`El SKU "${variant.sku}" está repetido entre las variantes.`, 400);
      }
      seen.add(variant.sku);
    }
  }

  /**
   * Builds the Mongo filter from named query params only. The client's query
   * object is never spread into it — every key below is read explicitly, which
   * is what stops `?category[$ne]=x` from becoming a filter operator.
   */
  async function buildFilter(
    query: Record<string, unknown>,
    scope: { publicOnly: boolean },
  ): Promise<Record<string, unknown>> {
    const filter: Record<string, unknown> = {};

    if (scope.publicOnly) {
      Object.assign(filter, PUBLIC_VISIBILITY);
    } else if (typeof query["isActive"] === "boolean") {
      filter["isActive"] = query["isActive"];
    }

    const category = query["category"];
    if (typeof category === "string") {
      // Filtering by a parent category must include its children, otherwise
      // "Bicicletas de montaña" would show nothing while every bike sits in one
      // of its subcategories.
      const children = await categoryModel.find({ parent: category }).select("_id").exec();
      const ids = [new MongooseTypes.ObjectId(category), ...children.map((child) => child._id)];
      filter["category"] = { $in: ids };
    }

    if (typeof query["brand"] === "string" && query["brand"] !== "") {
      filter["brand"] = { $regex: `^${escapeRegex(query["brand"])}$`, $options: "i" };
    }

    // Size and color live on variants; a product matches if any variant does.
    if (typeof query["size"] === "string" && query["size"] !== "") {
      filter["variants.size"] = { $regex: `^${escapeRegex(query["size"])}$`, $options: "i" };
    }
    if (typeof query["color"] === "string" && query["color"] !== "") {
      filter["variants.color"] = { $regex: `^${escapeRegex(query["color"])}$`, $options: "i" };
    }

    const minPrice = query["minPrice"];
    const maxPrice = query["maxPrice"];
    if (typeof minPrice === "number" || typeof maxPrice === "number") {
      const range: Record<string, number> = {};
      if (typeof minPrice === "number") range["$gte"] = minPrice;
      if (typeof maxPrice === "number") range["$lte"] = maxPrice;
      filter["price"] = range;
    }

    return filter;
  }

  /**
   * The paginated list every admin table and storefront grid runs on. Uses the
   * cross-cutting `parseListQuery`/`buildMeta` pair so `meta` is identical
   * across modules.
   */
  async function list(query: Record<string, unknown>, scope: { publicOnly: boolean }) {
    const { page, limit, skip, sort, search } = parseListQuery(query, {
      allowedSortFields: SORTABLE_FIELDS,
      defaultSort: "-createdAt",
    });

    const filter = await buildFilter(query, scope);

    if (search) {
      // Escaped: a search for `.*` matches the literal string, not every row.
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      filter["$or"] = [{ name: pattern }, { brand: pattern }, { "variants.sku": pattern }];
    }

    const [documents, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limit).populate("category").exec(),
      Product.countDocuments(filter).exec(),
    ]);

    return { documents, meta: buildMeta(total, page, limit) };
  }

  async function getBySlug(slug: string, scope: { publicOnly: boolean }): Promise<TDoc> {
    const filter: Record<string, unknown> = { slug };
    if (scope.publicOnly) Object.assign(filter, PUBLIC_VISIBILITY);

    const product = await Product.findOne(filter).populate("category").exec();
    if (!product) {
      throw new AppError(`${entityLabel} no encontrado.`, 404);
    }
    return product;
  }

  async function getById(id: string): Promise<TDoc> {
    const product = await Product.findById(id).populate("category").exec();
    if (!product) {
      throw new AppError(`${entityLabel} no encontrado.`, 404);
    }
    return product;
  }

  /**
   * Logical delete. A product that was ever purchasable keeps existing so
   * M4's inventory rows and M5's order references never point at a hole —
   * and so the admin can undo a mistaken removal.
   */
  async function archive(id: string, actor: ActorContext): Promise<TDoc> {
    const product = await findByIdOrFail(id);
    if (product.archivedAt) {
      throw new AppError(`${entityLabel} ya está archivado.`, 409);
    }

    product.isActive = false;
    product.archivedAt = new Date();
    await product.save();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.product_archived" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before: { isActive: true },
      after: { isActive: false },
      ip: actor.ip,
    });

    return product;
  }

  async function restore(id: string, actor: ActorContext): Promise<TDoc> {
    const product = await findByIdOrFail(id);
    if (!product.archivedAt) {
      throw new AppError(`${entityLabel} no está archivado.`, 409);
    }

    product.isActive = true;
    product.archivedAt = null;
    await product.save();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.product_restored" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before: { isActive: false },
      after: { isActive: true },
      ip: actor.ip,
    });

    return product;
  }

  /**
   * Replaces the entire spec sheet in one write. That single operation is what
   * covers all four editing actions the milestone requires — add, rename,
   * reorder and delete, for groups and for fields alike — and it matches how
   * the M10 editor saves: the admin edits the sheet as one unit.
   */
  async function replaceSpecGroups(id: string, groups: SpecGroup[], actor: ActorContext): Promise<TDoc> {
    const product = await findByIdOrFail(id);
    const before = { groups: product.specGroups.length };

    product.specGroups = groups;
    await product.save();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.spec_groups_updated" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before,
      after: { groups: groups.length },
      ip: actor.ip,
    });

    return product;
  }

  async function addGalleryImages(
    id: string,
    images: Omit<ProductImage, "order">[],
    actor: ActorContext,
  ): Promise<TDoc> {
    const product = await findByIdOrFail(id);

    if (product.gallery.length + images.length > MAX_GALLERY_IMAGES) {
      throw new AppError(`La galería no puede tener más de ${MAX_GALLERY_IMAGES} imágenes.`, 400);
    }

    const startOrder = product.gallery.length;
    product.gallery.push(...images.map((image, index) => ({ ...image, order: startOrder + index })));
    await product.save();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.gallery_updated" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      after: { added: images.length, total: product.gallery.length },
      ip: actor.ip,
    });

    return product;
  }

  /**
   * Removes the image from the document first, then from Cloudinary. If the
   * remote delete fails the asset is orphaned in the media library, which is
   * recoverable; the reverse order would leave the product pointing at a URL
   * that 404s, which is not.
   */
  async function removeGalleryImage(id: string, publicId: string, actor: ActorContext): Promise<TDoc> {
    const product = await findByIdOrFail(id);

    const remaining = product.gallery.filter((image) => image.publicId !== publicId);
    if (remaining.length === product.gallery.length) {
      throw new AppError("La imagen no pertenece a este producto.", 404);
    }

    // Re-index so `order` stays a dense 0..n-1 sequence after the removal.
    product.gallery = remaining.map((image, index) => ({ ...image, order: index }));
    await product.save();

    await deleteImage(publicId);

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.gallery_updated" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      after: { removed: publicId, total: product.gallery.length },
      ip: actor.ip,
    });

    return product;
  }

  async function reorderGallery(id: string, publicIds: string[], actor: ActorContext): Promise<TDoc> {
    const product = await findByIdOrFail(id);

    const byPublicId = new Map(product.gallery.map((image) => [image.publicId, image]));
    if (publicIds.length !== byPublicId.size || publicIds.some((publicId) => !byPublicId.has(publicId))) {
      throw new AppError("El orden enviado no coincide con las imágenes del producto.", 400);
    }

    product.gallery = publicIds.map((publicId, index) => ({ ...byPublicId.get(publicId)!, order: index }));
    await product.save();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.gallery_updated" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      after: { reordered: publicIds.length },
      ip: actor.ip,
    });

    return product;
  }

  return {
    findByIdOrFail,
    assertSlugIsFree,
    assertCategoryExists,
    assertVariantSkusAreUnique,
    resolveSlug,
    list,
    getById,
    getBySlug,
    archive,
    restore,
    replaceSpecGroups,
    addGalleryImages,
    removeGalleryImage,
    reorderGallery,
  };
}
