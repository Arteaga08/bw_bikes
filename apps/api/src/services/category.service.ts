import type { AdminCategory, AuditAction, CategoryImage, PublicCategory } from "@bw-bikes/shared";
import type { Model } from "mongoose";
import { Types } from "mongoose";
import type { ICategory } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery, slugify } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { deleteImage } from "./storage/storage.service.js";

const SORTABLE_FIELDS = ["order", "name", "createdAt"] as const;

interface CategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  parent?: string | null;
  order?: number;
  isActive?: boolean;
  usesSizes?: boolean;
}

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

/**
 * Anything that owns a `category` reference and must block the deletion of a
 * category still in use. Kept as a structural type so the service never
 * imports a concrete product model — the two catalogs stay decoupled.
 */
interface CategoryConsumer {
  countDocuments(filter: Record<string, unknown>): { exec(): Promise<number> };
}

export function toPublicCategory(category: ICategory): PublicCategory {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    ...(category.description ? { description: category.description } : {}),
    parent: category.parent ? String(category.parent) : null,
    order: category.order,
    usesSizes: category.usesSizes,
    ...(category.image ? { image: category.image } : {}),
  };
}

/**
 * The admin DTO — same fields as the storefront's, plus `isActive` and
 * timestamps. The storefront tree never needs `isActive` (it only ever walks
 * active categories via the `publicOnly` filter), but the admin table has to
 * tell an active category apart from a disabled one.
 */
export function toAdminCategory(category: ICategory): AdminCategory {
  return {
    ...toPublicCategory(category),
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

/**
 * One CRUD engine, instantiated once per category tree (bikes, accessories).
 * The two trees stay genuinely independent — separate collections, separate
 * slug namespaces, separate endpoints — while the rules that govern them are
 * written once. `moduleName` only labels the audit entries, so a reader can
 * tell which tree a change belongs to.
 */
export function createCategoryService(
  Category: Model<ICategory>,
  productModel: CategoryConsumer,
  moduleName: string,
) {
  /**
   * Two levels maximum. Checked against the parent document because the depth
   * of a node isn't knowable from the node alone: a category may become a
   * grandchild either by being created under a child, or by an existing root
   * being re-parented later — both paths land here.
   */
  async function assertParentIsValid(parentId: string, selfId?: string): Promise<void> {
    if (selfId && parentId === selfId) {
      throw new AppError("Una categoría no puede ser su propia categoría padre.", 400);
    }

    const parent = await Category.findById(parentId).exec();
    if (!parent) {
      throw new AppError("La categoría padre no existe.", 404);
    }
    if (parent.parent) {
      throw new AppError("La jerarquía admite máximo dos niveles: padre e hijo.", 400);
    }
  }

  /** Slug uniqueness is enforced by a unique index too; this turns the race loser's 11000 into a clear message. */
  async function assertSlugIsFree(slug: string, selfId?: string): Promise<void> {
    const filter: Record<string, unknown> = { slug };
    if (selfId) filter["_id"] = { $ne: new Types.ObjectId(selfId) };

    const existing = await Category.exists(filter);
    if (existing) {
      throw new AppError(`Ya existe una categoría con el slug "${slug}".`, 409);
    }
  }

  async function findByIdOrFail(id: string): Promise<ICategory> {
    const category = await Category.findById(id).exec();
    if (!category) {
      throw new AppError("Categoría no encontrada.", 404);
    }
    return category;
  }

  async function list(query: Record<string, unknown>, options: { publicOnly: boolean }) {
    const { page, limit, skip, sort, search } = parseListQuery(query, {
      allowedSortFields: SORTABLE_FIELDS,
      defaultSort: "order",
    });

    // Explicit filter construction — the client's query object never reaches
    // Mongo, only the specific keys read here.
    const filter: Record<string, unknown> = {};
    if (options.publicOnly) {
      filter["isActive"] = true;
    } else if (typeof query["isActive"] === "boolean") {
      filter["isActive"] = query["isActive"];
    }

    const parent = query["parent"];
    if (parent === "null" || parent === null) {
      filter["parent"] = null;
    } else if (typeof parent === "string") {
      filter["parent"] = new Types.ObjectId(parent);
    }

    if (search) {
      filter["name"] = { $regex: escapeRegex(search), $options: "i" };
    }

    // `.lean()`: `toPublicCategory`/`toAdminCategory` (whichever the caller
    // picks) only read plain fields — no document methods needed downstream.
    const [documents, total] = await Promise.all([
      Category.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      Category.countDocuments(filter).exec(),
    ]);

    // Returns the raw documents, not a mapped DTO — the caller (public vs
    // admin controller) picks `toPublicCategory` or `toAdminCategory`, same
    // split the product catalog already uses via `product.service.ts`.
    return { documents: documents as unknown as ICategory[], meta: buildMeta(total, page, limit) };
  }

  /**
   * The whole tree in one round trip: two levels means one query for roots,
   * one for every child, then a group-by in memory. Not paginated on purpose —
   * a navigation tree is bounded by design and is consumed as a unit. Raw
   * documents, for the same reason `list()` returns them raw.
   */
  async function tree(options: { publicOnly: boolean }): Promise<Array<{ root: ICategory; children: ICategory[] }>> {
    const filter: Record<string, unknown> = options.publicOnly ? { isActive: true } : {};

    // `.lean()`: consumed only by `toPublicCategory`/`toAdminCategory`, same
    // as `list()` above.
    const all = (await Category.find(filter).sort({ order: 1, name: 1 }).lean().exec()) as unknown as ICategory[];

    const childrenByParent = new Map<string, ICategory[]>();
    for (const category of all) {
      if (!category.parent) continue;
      const key = String(category.parent);
      const siblings = childrenByParent.get(key) ?? [];
      siblings.push(category);
      childrenByParent.set(key, siblings);
    }

    return all
      .filter((category) => !category.parent)
      .map((root) => ({ root, children: childrenByParent.get(String(root._id)) ?? [] }));
  }

  async function getBySlug(slug: string, options: { publicOnly: boolean }): Promise<ICategory> {
    const filter: Record<string, unknown> = { slug };
    if (options.publicOnly) filter["isActive"] = true;

    const category = await Category.findOne(filter).exec();
    if (!category) {
      throw new AppError("Categoría no encontrada.", 404);
    }
    return category;
  }

  async function create(input: CategoryInput, actor: ActorContext): Promise<ICategory> {
    const name = input.name!;
    const slug = input.slug ?? slugify(name);

    if (!slug) {
      throw new AppError("El nombre no produce un slug válido. Captura el slug manualmente.", 400);
    }
    await assertSlugIsFree(slug);
    if (input.parent) {
      await assertParentIsValid(input.parent);
    }

    // Explicit field list, never `{...input}` — mass assignment protection
    // beyond what stripUnknown already did (BACKEND_SECURITY_GUIDELINES.md §8).
    const category = await Category.create({
      name,
      slug,
      description: input.description,
      parent: input.parent ?? null,
      order: input.order ?? 0,
      isActive: input.isActive ?? true,
      usesSizes: input.usesSizes ?? true,
    });

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.category_created" satisfies AuditAction,
      module: moduleName,
      targetId: String(category._id),
      after: { slug: category.slug, parent: category.parent ? String(category.parent) : null },
      ip: actor.ip,
    });

    return category;
  }

  async function update(id: string, input: CategoryInput, actor: ActorContext): Promise<ICategory> {
    const category = await findByIdOrFail(id);
    const before = { slug: category.slug, parent: category.parent ? String(category.parent) : null };

    if (input.slug !== undefined && input.slug !== category.slug) {
      await assertSlugIsFree(input.slug, id);
      category.slug = input.slug;
    }

    if (input.parent !== undefined) {
      if (input.parent === null) {
        category.parent = null;
      } else {
        await assertParentIsValid(input.parent, id);
        // Re-parenting a category that already has children would create a
        // third level through the back door.
        const hasChildren = await Category.exists({ parent: category._id });
        if (hasChildren) {
          throw new AppError(
            "No se puede anidar una categoría que ya tiene subcategorías: la jerarquía admite máximo dos niveles.",
            400,
          );
        }
        category.parent = new Types.ObjectId(input.parent);
      }
    }

    if (input.name !== undefined) category.name = input.name;
    if (input.description !== undefined) category.description = input.description;
    if (input.order !== undefined) category.order = input.order;
    if (input.isActive !== undefined) category.isActive = input.isActive;
    if (input.usesSizes !== undefined) category.usesSizes = input.usesSizes;

    await category.save();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.category_updated" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before,
      after: { slug: category.slug, parent: category.parent ? String(category.parent) : null },
      ip: actor.ip,
    });

    return category;
  }

  /**
   * Real deletion, but only when the category is empty. A category still
   * holding subcategories or products can't be removed silently — doing so
   * would leave products pointing at an id that resolves to nothing, and the
   * admin would only find out when the storefront 500s. 409 + the actual
   * counts is the actionable answer.
   */
  async function remove(id: string, actor: ActorContext): Promise<void> {
    const category = await findByIdOrFail(id);

    const [childCount, productCount] = await Promise.all([
      Category.countDocuments({ parent: category._id }).exec(),
      productModel.countDocuments({ category: category._id }).exec(),
    ]);

    if (childCount > 0 || productCount > 0) {
      const reasons: string[] = [];
      if (childCount > 0) reasons.push(`${childCount} subcategoría(s)`);
      if (productCount > 0) reasons.push(`${productCount} producto(s)`);
      throw new AppError(
        `No se puede eliminar la categoría porque tiene ${reasons.join(" y ")}. Reasigna o elimina ese contenido primero.`,
        409,
      );
    }

    await category.deleteOne();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.category_deleted" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before: { slug: category.slug },
      ip: actor.ip,
    });
  }

  /**
   * Replaces the category's image, deleting the previous Cloudinary asset (if
   * any) only **after** the document is saved — same order as
   * `product.service.ts`'s `removeGalleryImage`: a failed remote delete
   * orphans an asset (recoverable), the reverse order would leave the
   * category pointing at a URL that 404s (not recoverable by itself).
   */
  async function setImage(id: string, image: CategoryImage, actor: ActorContext): Promise<ICategory> {
    const category = await findByIdOrFail(id);
    const previousPublicId = category.image?.publicId;

    category.image = image;
    await category.save();

    if (previousPublicId) {
      await deleteImage(previousPublicId);
    }

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.category_image_updated" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      after: { publicId: image.publicId },
      ip: actor.ip,
    });

    return category;
  }

  async function removeImage(id: string, actor: ActorContext): Promise<ICategory> {
    const category = await findByIdOrFail(id);
    if (!category.image) {
      throw new AppError("La categoría no tiene imagen.", 409);
    }
    const publicId = category.image.publicId;

    category.image = undefined;
    await category.save();

    await deleteImage(publicId);

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.category_image_updated" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before: { publicId },
      ip: actor.ip,
    });

    return category;
  }

  return { list, tree, getBySlug, findByIdOrFail, create, update, remove, setImage, removeImage };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
