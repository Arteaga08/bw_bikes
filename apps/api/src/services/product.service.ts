import type {
  AuditAction,
  ItemType,
  ProductImage,
  ProductVariant,
  PublicCatalogFilterOptions,
  SpecGroup,
} from "@bw-bikes/shared";
import type { Document, Model, PopulateOptions, Types } from "mongoose";
import { Types as MongooseTypes } from "mongoose";
import type { ICategory } from "../models/index.js";
import { Badge, Brand, ColorTemplate, InventoryItem, MAX_GALLERY_IMAGES, SpecTemplate } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery, slugify } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { toPublicBrand } from "./brand.service.js";
import { learnSpecTemplates } from "./spec-template.service.js";
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
  brand: Types.ObjectId;
  category: Types.ObjectId;
  description: string;
  price: number;
  compareAtPrice?: number;
  variants: ProductVariant[];
  specGroups: SpecGroup[];
  gallery: ProductImage[];
  badges: Types.ObjectId[];
  isNewArrival: boolean;
  isCustomerFavorite: boolean;
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
  /** `InventoryItem` rows are keyed by `{itemType, itemId, sku}` — `remove()` needs this to check for existing stock. */
  itemType: ItemType;
}

/** Exported so `on-sale.service.ts` can re-sort its in-memory merge of both catalogs by the exact same vocabulary `list()` validates against — a caller-controlled sort field must never drift between the two. */
export const SORTABLE_FIELDS = ["createdAt", "price", "name"] as const;

/**
 * Named compound orders the storefront's "Ordenar por" control exposes for
 * "Novedades primero"/"Favoritas primero" — a bare `-isNewArrival` would
 * split the grid into two blocks with an arbitrary order inside each, so
 * both alias to the flag first, `createdAt` descending as the tiebreaker.
 * Exported for the same reason as `SORTABLE_FIELDS` above.
 */
export const SORT_ALIASES = {
  "-isNewArrival": { isNewArrival: -1, createdAt: -1 },
  "-isCustomerFavorite": { isCustomerFavorite: -1, createdAt: -1 },
} as const;

/** Only active, never-archived products are visible to the storefront. */
const PUBLIC_VISIBILITY = { isActive: true, archivedAt: null } as const;

/** A color only ever needs a "before"/"after" shot — the cap is optional (0 or 1 is fine), it just blocks a 3rd. Enforced on both the retag path and the upload-batch path. */
const MAX_IMAGES_PER_COLOR = 2;

/** `"a,b, c"` → `["a", "b", "c"]`. The multi-select shape for `category`/`brand`/`size`/`color` — a single value with no comma is still a valid one-item list, so `?brand=trek` keeps working unchanged. */
function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createProductService<TDoc extends ProductDocument>(
  Product: Model<TDoc>,
  options: ProductServiceOptions,
) {
  const { moduleName, categoryModel, entityLabel, itemType } = options;

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

  /** One brand collection shared by both catalogs (see `brand.model.ts`) — no tree to inject, unlike `assertCategoryExists`. */
  async function assertBrandExists(brandId: string): Promise<void> {
    if (!(await Brand.exists({ _id: brandId }))) {
      throw new AppError("La marca indicada no existe.", 404);
    }
  }

  /** Badges are curated by hand, same as `relatedAccessories` — a dangling reference would render as a blank chip on the PDP with no clue why. */
  async function assertBadgesExist(badgeIds: string[]): Promise<void> {
    if (badgeIds.length === 0) return;
    const found = await Badge.countDocuments({ _id: { $in: badgeIds } }).exec();
    if (found !== badgeIds.length) {
      throw new AppError("Uno o más badges indicados no existen.", 404);
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
   * Variants in `next` whose SKU wasn't already on the product before this
   * update — the only rows an `update()` may seed `InventoryItem` rows for.
   * Keyed by SKU because a variant carries no `_id` of its own (see
   * `ProductVariant`); `previousSkus` must be snapshotted before the caller
   * mutates the document's own `variants` array.
   */
  function partitionNewVariants(previousSkus: ReadonlySet<string>, next: ProductVariant[]): ProductVariant[] {
    return next.filter((variant) => !previousSkus.has(variant.sku));
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

    // Unlike `isActive`, this one applies in both scopes: the storefront's
    // "Novedades" rail reads it publicly, the admin catalog filters by it too.
    if (typeof query["isNewArrival"] === "boolean") {
      filter["isNewArrival"] = query["isNewArrival"];
    }

    // Same reasoning as `isNewArrival`: public rail + admin catalog filter.
    if (typeof query["isCustomerFavorite"] === "boolean") {
      filter["isCustomerFavorite"] = query["isCustomerFavorite"];
    }

    // "En oferta" == carries a `compareAtPrice` that's actually above `price`
    // — the same rule `product.validator.ts` already enforces at write time.
    // A missing `compareAtPrice` sorts below any number in Mongo's comparison
    // order, so `$gt` alone excludes it — no separate `$exists` check needed.
    if (query["onSale"] === true) {
      filter["$expr"] = { $gt: ["$compareAtPrice", "$price"] };
    }

    const category = query["category"];
    if (typeof category === "string" && category !== "") {
      // Filtering by a parent category must include its children, otherwise
      // "Bicicletas de montaña" would show nothing while every bike sits in one
      // of its subcategories. One query expands every selected parent at once,
      // rather than one per id, for the multi-select case.
      const ids = splitList(category);
      const children = await categoryModel.find({ parent: { $in: ids } }).select("_id").exec();
      const allIds = [...ids.map((id) => new MongooseTypes.ObjectId(id)), ...children.map((child) => child._id)];
      filter["category"] = { $in: allIds };
    }

    // `brand` travels as `slug`s (never ids — the client never needs to know
    // Mongo's), resolved to their references here. No match means the filter
    // deliberately matches nothing, same as any other unmet filter — not
    // "ignore the filter".
    if (typeof query["brand"] === "string" && query["brand"] !== "") {
      const slugs = splitList(query["brand"]).map((slug) => slug.toLowerCase());
      const brands = await Brand.find({ slug: { $in: slugs } })
        .select("_id")
        .exec();
      filter["brand"] = { $in: brands.map((brand) => brand._id) };
    }

    // Size and color live on variants; a product matches if any variant does.
    if (typeof query["size"] === "string" && query["size"] !== "") {
      const patterns = splitList(query["size"]).map((value) => new RegExp(`^${escapeRegex(value)}$`, "i"));
      filter["variants.size"] = { $in: patterns };
    }
    if (typeof query["color"] === "string" && query["color"] !== "") {
      const patterns = splitList(query["color"]).map((value) => new RegExp(`^${escapeRegex(value)}$`, "i"));
      filter["variants.color"] = { $in: patterns };
    }

    const minPrice = query["minPrice"];
    const maxPrice = query["maxPrice"];
    if (typeof minPrice === "number" || typeof maxPrice === "number") {
      const range: Record<string, number> = {};
      if (typeof minPrice === "number") range["$gte"] = minPrice;
      if (typeof maxPrice === "number") range["$lte"] = maxPrice;
      filter["price"] = range;
    }

    const specs = query["spec"];
    if (Array.isArray(specs) && specs.length > 0) {
      // Each item is `label:value1|value2` — AND across items (a product
      // must match every selected label), OR within one label's values.
      const clauses = specs
        .filter((item): item is string => typeof item === "string" && item.includes(":"))
        .map((item) => {
          const separatorIndex = item.indexOf(":");
          const label = item.slice(0, separatorIndex).trim();
          const values = item
            .slice(separatorIndex + 1)
            .split("|")
            .map((value) => value.trim())
            .filter(Boolean);
          return { label, values };
        })
        .filter((clause) => clause.label !== "" && clause.values.length > 0);

      if (clauses.length > 0) {
        filter["$and"] = clauses.map(({ label, values }) => ({
          specGroups: {
            $elemMatch: {
              fields: {
                $elemMatch: {
                  label: new RegExp(`^${escapeRegex(label)}$`, "i"),
                  value: { $in: values },
                },
              },
            },
          },
        }));
      }
    }

    return filter;
  }

  /**
   * On the storefront, a badge an admin deactivated must stop rendering
   * immediately, even if it's still assigned on the product — not linger
   * until someone remembers to unassign it everywhere. The admin editor, by
   * contrast, needs every assigned badge visible so it can be removed
   * deliberately (same reasoning as `relatedAccessories`'s admin/public
   * split in `bike.service.ts`).
   */
  function badgesPopulateOption(publicOnly: boolean): { path: "badges"; match?: { isActive: boolean } } {
    return publicOnly ? { path: "badges", match: { isActive: true } } : { path: "badges" };
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
      sortAliases: SORT_ALIASES,
    });

    const filter = await buildFilter(query, scope);

    if (search) {
      // Escaped: a search for `.*` matches the literal string, not every row.
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      // `brand` is a reference now, not text — resolve which brands match by
      // name first, then fold their ids into the same `$or` the name/SKU
      // search already runs.
      const matchingBrands = await Brand.find({ name: pattern }).select("_id").exec();
      filter["$or"] = [
        { name: pattern },
        { "variants.sku": pattern },
        ...(matchingBrands.length > 0 ? [{ brand: { $in: matchingBrands.map((b) => b._id) } }] : []),
      ];
    }

    // `list()` backs both the admin table (`toAdminBike`/`toAdminAccessory`,
    // which reads `.populated(path)` — a hydrated-Document-only method) and
    // the public storefront grid (`toPublicBike`/`toPublicAccessory`, which
    // no longer needs it — see those functions' own doc comments). `.lean()`
    // skips building a full Mongoose document for every row, which matters
    // here: this query backs every catalog page, every home rail and every
    // search keystroke. Scoped to `publicOnly` so the admin path keeps
    // getting real documents.
    const productQuery = Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("category")
      .populate("brand")
      .populate(badgesPopulateOption(scope.publicOnly));
    if (scope.publicOnly) productQuery.lean();

    const [documents, total] = await Promise.all([
      productQuery.exec() as unknown as Promise<TDoc[]>,
      Product.countDocuments(filter).exec(),
    ]);

    return { documents, meta: buildMeta(total, page, limit) };
  }

  /**
   * Every match for a filter, sorted, capped at `cap` documents — no
   * pagination. Built for `on-sale.service.ts`'s cross-collection merge:
   * combining bikes and accessories into one paginated "Ofertas" listing
   * needs a full sorted slice from *each* collection before it can page the
   * merged result, and `list()`'s own `limit` tops out at the shared
   * `MAX_LIMIT` (100, `list-query.ts`) same as every other endpoint — too low
   * once the caller needs more than one page's worth to merge correctly.
   * Unlike `list()`, this never applies `search` — its one caller has no
   * search box of its own.
   */
  async function listAllMatching(
    query: Record<string, unknown>,
    scope: { publicOnly: boolean },
    cap: number,
  ): Promise<TDoc[]> {
    const { sort } = parseListQuery(query, {
      allowedSortFields: SORTABLE_FIELDS,
      defaultSort: "-createdAt",
      sortAliases: SORT_ALIASES,
    });
    const filter = await buildFilter(query, scope);

    // Same `.lean()`/`toPublicX` reasoning as `list()` above — the only
    // caller today (`on-sale.service.ts`) always passes `publicOnly: true`,
    // and it's the worse offender of the two: up to `ON_SALE_FETCH_CAP`
    // full documents per catalog, most of which get discarded after the
    // in-memory merge.
    const productQuery = Product.find(filter)
      .sort(sort)
      .limit(cap)
      .populate("category")
      .populate("brand")
      .populate(badgesPopulateOption(scope.publicOnly));
    if (scope.publicOnly) productQuery.lean();

    return productQuery.exec() as unknown as Promise<TDoc[]>;
  }

  /**
   * Resolves a distinct-color tally (from either `getFilterOptions`'s own
   * `$facet` or `getColorSwatches`'s standalone aggregation below) against
   * `ColorTemplate` for hex codes — the one piece of work both call sites
   * share, factored out so it's written once.
   */
  async function resolveColorSwatches(
    distinctColors: Array<{ _id: string; count: number }>,
  ): Promise<PublicCatalogFilterOptions["colors"]> {
    // Fetched in bulk (bounded by `MAX_COLOR_TEMPLATES`) rather than one
    // query per color value — cheap either way, but this keeps it to one
    // round trip regardless of how many distinct colors the catalog has.
    const colorDocs =
      distinctColors.length > 0 ? await ColorTemplate.find().select("value hex secondaryHex").lean().exec() : [];
    const colorByKey = new Map(colorDocs.map((doc) => [doc.value.trim().toLowerCase(), doc]));
    return distinctColors.map((row) => {
      const template = colorByKey.get(row._id.trim().toLowerCase());
      return { value: row._id, hex: template?.hex ?? null, secondaryHex: template?.secondaryHex ?? null };
    });
  }

  /**
   * Just the color swatches — the same vocabulary `getFilterOptions` derives
   * as one of its five facets, without running the other four (sizes,
   * brands, price, spec groups) a caller that only wants color dots
   * (`CatalogProductCard`, the PDP's cross-sell chips) never asked for.
   * `apps/web`'s `getPublicColorSwatches` used to call the full
   * `getFilterOptions` endpoint and discard everything but `.colors` —
   * on a PDP, which shows no filter sidebar at all, that aggregation's other
   * four facets were pure waste on every request (M-optimización).
   */
  async function getColorSwatches(): Promise<PublicCatalogFilterOptions["colors"]> {
    const distinctColors = await Product.aggregate<{ _id: string; count: number }>([
      { $match: PUBLIC_VISIBILITY },
      { $unwind: "$variants" },
      { $match: { "variants.color": { $type: "string", $ne: "" } } },
      { $group: { _id: "$variants.color", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec();

    return resolveColorSwatches(distinctColors);
  }

  /**
   * The filter sidebar's vocabulary, derived from the products actually in
   * this catalog — never a fixed enum, same reasoning as `SizeTemplate`/
   * `ColorTemplate`'s own doc comments. One aggregation, one round trip:
   * `$facet` runs every tally over the same `$match` pass. Each list comes
   * back sorted by how many products carry that value, most first — the
   * counts themselves never leave this function, since the filter sidebar
   * shows no numbers next to an option (Manuel's call).
   */
  async function getFilterOptions(): Promise<PublicCatalogFilterOptions> {
    // Only spec labels an admin explicitly turned on (`isFilterable`). The
    // canonical display label is whichever template defined it first — a
    // product's own spec sheet can carry a differently-cased copy of the
    // same label, and grouping must not fork "Material" and "material" into
    // two filter groups.
    const templates = await SpecTemplate.find({ isActive: true, "fields.isFilterable": true })
      .sort({ order: 1, title: 1 })
      .lean()
      .exec();

    const canonicalLabelByKey = new Map<string, string>();
    for (const template of templates) {
      for (const field of template.fields) {
        if (!field.isFilterable) continue;
        const key = field.label.trim().toLowerCase();
        if (!canonicalLabelByKey.has(key)) canonicalLabelByKey.set(key, field.label.trim());
      }
    }
    const filterableKeys = [...canonicalLabelByKey.keys()];

    const [facets] = await Product.aggregate<{
      sizes: Array<{ _id: string; count: number }>;
      colors: Array<{ _id: string; count: number }>;
      brands: Array<{ _id: Types.ObjectId; count: number }>;
      price: Array<{ _id: null; min: number; max: number }>;
      specs: Array<{ _id: { key: string; value: string }; count: number }>;
    }>([
      { $match: PUBLIC_VISIBILITY },
      {
        $facet: {
          sizes: [
            { $unwind: "$variants" },
            { $match: { "variants.size": { $type: "string", $ne: "" } } },
            { $group: { _id: "$variants.size", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          colors: [
            { $unwind: "$variants" },
            { $match: { "variants.color": { $type: "string", $ne: "" } } },
            { $group: { _id: "$variants.color", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          brands: [
            { $group: { _id: "$brand", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          price: [{ $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }],
          // Skipped entirely when no admin has turned any label on — an
          // `$unwind` over `specGroups.fields` with nothing to `$match`
          // against would just cost work for an empty result.
          specs:
            filterableKeys.length === 0
              ? []
              : [
                  { $unwind: "$specGroups" },
                  { $unwind: "$specGroups.fields" },
                  {
                    $addFields: {
                      "specGroups.fields.__key": { $toLower: { $trim: { input: "$specGroups.fields.label" } } },
                    },
                  },
                  { $match: { "specGroups.fields.__key": { $in: filterableKeys } } },
                  {
                    $group: {
                      _id: { key: "$specGroups.fields.__key", value: "$specGroups.fields.value" },
                      count: { $sum: 1 },
                    },
                  },
                  { $sort: { count: -1 } },
                ],
        },
      },
    ]).exec();

    const result = facets ?? { sizes: [], colors: [], brands: [], price: [], specs: [] };

    const brandDocs = await Brand.find({ _id: { $in: result.brands.map((row) => row._id) }, isActive: true }).exec();
    const brandById = new Map(brandDocs.map((brand) => [String(brand._id), brand]));
    const brands = result.brands
      .map((row) => brandById.get(String(row._id)))
      .filter((brand): brand is (typeof brandDocs)[number] => Boolean(brand))
      .map(toPublicBrand);

    const colors = await resolveColorSwatches(result.colors);

    const sizes = result.sizes.map((row) => row._id);

    const priceRow = result.price[0];
    const price = priceRow ? { min: priceRow.min, max: priceRow.max } : null;

    // `result.specs` arrives sorted by count descending across every
    // label/value pair at once; splitting it into per-label buckets without
    // re-sorting keeps each bucket's own values in that same descending
    // order — a subsequence of a sorted sequence is still sorted.
    const specValuesByKey = new Map<string, string[]>();
    for (const row of result.specs) {
      const values = specValuesByKey.get(row._id.key) ?? [];
      values.push(row._id.value);
      specValuesByKey.set(row._id.key, values);
    }
    // Template order, not facet order — the sidebar's group order follows
    // admin-curated `SpecTemplate.order`, same as every other
    // template-driven list in this catalog.
    const specs = [...canonicalLabelByKey.entries()]
      .map(([key, label]) => ({ label, values: specValuesByKey.get(key) ?? [] }))
      .filter((group) => group.values.length > 0);

    return { brands, sizes, colors, price, specs };
  }

  /**
   * `extraPopulate` lets a catalog with its own extra refs (`Bike.relatedAccessories`)
   * fold them into this same query instead of a second round-trip after the
   * fact — `bike.service.ts`'s `getPublicBySlug` used to `await product.populate(...)`
   * as a separate step, which is a second full Mongo round-trip for a value
   * Mongoose can resolve in the same `.exec()` alongside category/brand/badges.
   */
  async function getBySlug(
    slug: string,
    scope: { publicOnly: boolean },
    extraPopulate?: PopulateOptions,
  ): Promise<TDoc> {
    const filter: Record<string, unknown> = { slug };
    if (scope.publicOnly) Object.assign(filter, PUBLIC_VISIBILITY);

    let query = Product.findOne(filter)
      .populate("category")
      .populate("brand")
      .populate(badgesPopulateOption(scope.publicOnly));
    if (extraPopulate) query = query.populate(extraPopulate);

    const product = await query.exec();
    if (!product) {
      throw new AppError(`${entityLabel} no encontrado.`, 404);
    }
    return product;
  }

  async function getById(id: string): Promise<TDoc> {
    const product = await Product.findById(id).populate("category").populate("brand").populate("badges").exec();
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
   * Real deletion — only reachable once `archive()` already ran, and only
   * once no `InventoryItem` row still points at this product (M4 keeps
   * physical stock in its own collection, decoupled from the catalog, so a
   * product can carry real stock rows even while archived; hard-deleting out
   * from under them would leave that inventory pointing at nothing). Same
   * actionable-409 shape as `category.service.ts`'s `remove()`.
   */
  async function remove(id: string, actor: ActorContext): Promise<void> {
    const product = await findByIdOrFail(id);

    if (!product.archivedAt) {
      throw new AppError(`${entityLabel} debe archivarse antes de poder eliminarse.`, 400);
    }

    const inventoryCount = await InventoryItem.countDocuments({ itemType, itemId: product._id }).exec();
    if (inventoryCount > 0) {
      throw new AppError(
        `No se puede eliminar: tiene ${inventoryCount} fila(s) de inventario asociadas. Elimina el inventario primero.`,
        409,
      );
    }

    await product.deleteOne();

    // Document first, remote assets second — same order as `removeGalleryImage`:
    // a failed remote delete just orphans an asset (recoverable), the reverse
    // order would risk losing the `publicId` if the document delete failed.
    await Promise.all(product.gallery.map((image) => deleteImage(image.publicId)));

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.product_deleted" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before: { slug: product.slug },
      ip: actor.ip,
    });
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

    // Best-effort, same discipline as `recordAuditLog`: awaited so it
    // completes before this responds, but its own try/catch (see
    // `learnSpecTemplates`) swallows any failure rather than letting a
    // learning error fail a spec sheet that already saved successfully.
    await learnSpecTemplates(groups);

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

    // Same "fails atomically, never half-succeeds" discipline as the
    // MAX_GALLERY_IMAGES check above — checked, and possibly thrown, before
    // any mutation of `product.gallery` or `product.save()`.
    const incomingColors = new Set(images.map((image) => image.color).filter((color): color is string => Boolean(color)));
    for (const color of incomingColors) {
      const existingCount = product.gallery.filter((image) => image.color === color).length;
      const incomingCount = images.filter((image) => image.color === color).length;
      if (existingCount + incomingCount > MAX_IMAGES_PER_COLOR) {
        throw new AppError(`El color "${color}" no puede tener más de ${MAX_IMAGES_PER_COLOR} fotos.`, 400);
      }
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

  /**
   * Retags one gallery image's `color` — admin-only prep for a future public
   * gallery-by-color swap (no storefront reads this yet). Rebuilds the array
   * via `.map` rather than mutating the matched subdocument in place, same
   * discipline as `removeGalleryImage`/`reorderGallery`: `{_id:false}`
   * subdocuments are safest replaced wholesale.
   */
  async function updateGalleryImageColor(
    id: string,
    publicId: string,
    color: string | undefined,
    actor: ActorContext,
  ): Promise<TDoc> {
    const product = await findByIdOrFail(id);

    if (color) {
      const existingCount = product.gallery.filter((image) => image.color === color && image.publicId !== publicId).length;
      if (existingCount >= MAX_IMAGES_PER_COLOR) {
        throw new AppError(`El color "${color}" ya tiene ${MAX_IMAGES_PER_COLOR} fotos. Quita una antes de agregar otra.`, 400);
      }
    }

    let found = false;
    // Rebuilt field by field, not `{...image, color}` — these are Mongoose
    // subdocuments, and spreading one copies its internals (`$__`, `_doc`)
    // instead of the data (same pitfall `toPublicSpecGroups` documents).
    product.gallery = product.gallery.map((image) => {
      if (image.publicId !== publicId) return image;
      found = true;
      return {
        publicId: image.publicId,
        url: image.url,
        width: image.width,
        height: image.height,
        ...(image.alt ? { alt: image.alt } : {}),
        ...(color ? { color } : {}),
        order: image.order,
      };
    });
    if (!found) {
      throw new AppError("La imagen no pertenece a este producto.", 404);
    }
    await product.save();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.gallery_updated" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      after: { publicId, color: color ?? null },
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
    assertBrandExists,
    assertBadgesExist,
    assertVariantSkusAreUnique,
    partitionNewVariants,
    resolveSlug,
    list,
    listAllMatching,
    getFilterOptions,
    getColorSwatches,
    getById,
    getBySlug,
    archive,
    restore,
    remove,
    replaceSpecGroups,
    addGalleryImages,
    removeGalleryImage,
    updateGalleryImageColor,
    reorderGallery,
  };
}
