import type {
  AdminInventoryProductCounts,
  AdminInventoryProductDetail,
  AdminInventoryProductRow,
  AdminInventoryVariantRow,
  FulfillmentMode,
  InventoryProductStatus,
  ItemType,
} from "@bw-bikes/shared";
import type { Model } from "mongoose";
import { Types } from "mongoose";
import { Accessory, AccessoryCategory, Bike, BikeCategory, Brand, InventoryItem } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery } from "../utils/index.js";
import { settingsService } from "./settings.service.js";

/**
 * The product-first read model behind `/admin/inventario`. A separate module
 * from `inventory.service.ts` (already 1000+ lines) on purpose: this file
 * only ever *reads*, through an aggregation driven off the catalog
 * collections rather than `InventoryItem` — see the module doc on
 * `listProducts` for why. It depends on nothing from `inventory.service.ts`,
 * so there is no import cycle to manage.
 */

/** Same mapping shape `inventory.service.ts` uses for `CATALOG_LOOKUP_MODELS` — `Bike`/`Accessory` are two genuinely distinct Mongoose models, so a plain ternary produces incompatible overloaded `.aggregate()`/`.find()` signatures TS can't call. */
interface CatalogProductDoc {
  _id: Types.ObjectId;
  name: string;
  brand: Types.ObjectId;
  category: Types.ObjectId;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  gallery: { url: string; order: number }[];
  variants: {
    sku: string;
    size?: string;
    color?: string;
    fulfillmentMode: FulfillmentMode;
    isActive: boolean;
  }[];
}

const CATALOG_MODELS: Record<ItemType, Model<CatalogProductDoc>> = {
  bike: Bike as unknown as Model<CatalogProductDoc>,
  accessory: Accessory as unknown as Model<CatalogProductDoc>,
};

interface CategoryDoc {
  _id: Types.ObjectId;
  name: string;
  parent: Types.ObjectId | null;
}

const CATEGORY_MODELS: Record<ItemType, Model<CategoryDoc>> = {
  bike: BikeCategory as unknown as Model<CategoryDoc>,
  accessory: AccessoryCategory as unknown as Model<CategoryDoc>,
};

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  bike: "Bicicleta",
  accessory: "Accesorio",
};

const SORTABLE_FIELDS = ["name", "totalAvailable", "createdAt"] as const;

/** Raw shape the aggregation's `rows` branch projects, before the JS pass that sorts `gallery` and attaches `itemType`. */
interface RawProductRow {
  itemId: string;
  name: string;
  brand: string;
  categoryName: string;
  gallery: { url: string; order: number }[];
  variantCount: number;
  untrackedVariantCount: number;
  totalAvailable: number;
  totalOnHand: number;
  totalReserved: number;
  outOfStockVariants: number;
  lowStockVariants: number;
  status: InventoryProductStatus;
}

interface FacetResult {
  rows: RawProductRow[];
  total: { value: number }[];
  counts: { _id: InventoryProductStatus; n: number }[];
}

export interface ListInventoryProductsResult {
  products: AdminInventoryProductRow[];
  counts: AdminInventoryProductCounts;
  meta: ReturnType<typeof buildMeta>;
}

/**
 * Products in `itemType`'s catalog, one row per document — never per SKU.
 *
 * Driven off `Bike`/`Accessory` with a `$lookup` into `inventoryitems`,
 * rather than a `$group` over `InventoryItem`, because every filter this
 * endpoint offers (name, brand, category) lives on the product document:
 * grouping from the inventory side would need three separate "resolve ids →
 * `$in`" pre-queries all colliding on the same filter key `listItems` already
 * has to arbitrate between `itemId` and `category`. Driving from the catalog
 * makes them plain `$match` clauses, keeps pagination exact (a row is always
 * exactly one document), and — the detail that matters for this redesign —
 * makes products with zero inventory rows visible, which is what lets the
 * product modal absorb "register a new SKU" instead of needing a separate
 * flow for it.
 *
 * The `stock` filter runs *after* the `$lookup`, so it can't use an index;
 * accepted because the base `$match` (indexed on `category`/`brand`/
 * `isActive`) runs first and these catalogs are small. The two enrichment
 * `$lookup`s (brand/category name) run inside the `rows` branch, after
 * `$skip`/`$limit` — the same "join after the page, never per row" discipline
 * `loadCatalogLookup` already follows for the SKU-level list.
 */
async function listProducts(query: Record<string, unknown>): Promise<ListInventoryProductsResult> {
  const itemTypeRaw = query["itemType"];
  if (typeof itemTypeRaw !== "string") {
    throw new AppError("El tipo de producto es obligatorio.", 400);
  }
  const itemType = itemTypeRaw as ItemType;

  const { page, limit, skip, sort, search } = parseListQuery(query, {
    allowedSortFields: SORTABLE_FIELDS,
    defaultSort: "name",
  });

  const { inventory } = await settingsService.get();
  const defaultThreshold = inventory.lowStockThresholdUnits;

  const Product = CATALOG_MODELS[itemType];
  const CategoryModel = CATEGORY_MODELS[itemType];

  // Named query params only — never spread the client's query object into a
  // filter, same discipline `listItems` documents for the SKU-level list.
  const match: Record<string, unknown> = { isActive: true, archivedAt: null };

  const category = query["category"];
  if (typeof category === "string" && category !== "") {
    // A parent category must include its children, same expansion
    // `product.service.ts`'s `buildFilter` runs for the storefront/admin
    // catalog grids.
    const children = await CategoryModel.find({ parent: category }).select("_id").exec();
    match["category"] = {
      $in: [new Types.ObjectId(category), ...children.map((child) => child._id)],
    };
  }

  const brandSlug = query["brand"];
  if (typeof brandSlug === "string" && brandSlug !== "") {
    // Travels as a slug, never an id — resolved here. No match means the
    // filter deliberately matches nothing, not "ignore the filter".
    const brands = await Brand.find({ slug: brandSlug.trim().toLowerCase() })
      .select("_id")
      .exec();
    match["brand"] = { $in: brands.map((doc) => doc._id) };
  }

  if (search !== undefined) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    // `brand` is a reference, not text — resolve which brands match by name
    // first, then fold their ids into the same `$or` name/SKU search runs,
    // mirroring `product.service.ts`'s `list()`.
    const matchingBrands = await Brand.find({ name: pattern }).select("_id").exec();
    match["$or"] = [
      { name: pattern },
      { "variants.sku": pattern },
      ...(matchingBrands.length > 0 ? [{ brand: { $in: matchingBrands.map((doc) => doc._id) } }] : []),
    ];
  }

  const stock = query["stock"];
  const statusMatch = stock === "out" || stock === "low" ? [{ $match: { status: stock } }] : [];

  const [facetResult] = await Product.aggregate<FacetResult>([
    { $match: match },
    {
      // `localField`/`foreignField` (rather than a `let`+`$expr` pipeline
      // match) is what lets this join use the `{ itemId: 1 }` index added to
      // `InventoryItem` for exactly this lookup.
      $lookup: {
        from: InventoryItem.collection.name,
        localField: "_id",
        foreignField: "itemId",
        pipeline: [
          { $match: { itemType } },
          { $project: { _id: 0, sku: 1, onHand: 1, reserved: 1, lowStockThreshold: 1 } },
        ],
        as: "stock",
      },
    },
    {
      $addFields: {
        activeVariants: { $filter: { input: "$variants", as: "v", cond: { $eq: ["$$v.isActive", true] } } },
      },
    },
    {
      $addFields: {
        // Only `in_stock` variants hold physical stock — `on_request`/
        // `preorder` variants are excluded from every count below, the same
        // rule `InventoryRow` applies today (`isOnRequest` skips the badge).
        stockVariants: {
          $filter: { input: "$activeVariants", as: "v", cond: { $eq: ["$$v.fulfillmentMode", "in_stock"] } },
        },
      },
    },
    {
      $addFields: {
        rows: {
          $map: {
            input: "$stockVariants",
            as: "v",
            in: {
              $let: {
                // Kept as the filtered *array*, not collapsed with
                // `$arrayElemAt` up front: a 0-vs-1-length array makes
                // `tracked` an unambiguous `$size` check. Collapsing first
                // and comparing the result against `null` doesn't work — an
                // out-of-bounds `$arrayElemAt` returns a missing value, and
                // in aggregation expressions missing is *not* `$eq`/`$ne`
                // equal to `null` even though field access and `$ifNull`
                // both treat them the same way for defaulting.
                vars: {
                  matched: { $filter: { input: "$stock", as: "s", cond: { $eq: ["$$s.sku", "$$v.sku"] } } },
                },
                in: {
                  // `tracked: false` means "no InventoryItem row yet" — not
                  // the same problem as "agotado", so it must never fold
                  // into `outOfStockVariants` below.
                  tracked: { $gt: [{ $size: "$$matched" }, 0] },
                  onHand: { $ifNull: [{ $arrayElemAt: ["$$matched.onHand", 0] }, 0] },
                  reserved: { $ifNull: [{ $arrayElemAt: ["$$matched.reserved", 0] }, 0] },
                  available: {
                    $subtract: [
                      { $ifNull: [{ $arrayElemAt: ["$$matched.onHand", 0] }, 0] },
                      { $ifNull: [{ $arrayElemAt: ["$$matched.reserved", 0] }, 0] },
                    ],
                  },
                  threshold: { $ifNull: [{ $arrayElemAt: ["$$matched.lowStockThreshold", 0] }, defaultThreshold] },
                },
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        variantCount: { $size: "$activeVariants" },
        untrackedVariantCount: {
          $size: { $filter: { input: "$rows", as: "r", cond: { $eq: ["$$r.tracked", false] } } },
        },
        totalOnHand: { $sum: "$rows.onHand" },
        totalReserved: { $sum: "$rows.reserved" },
        totalAvailable: { $sum: "$rows.available" },
        outOfStockVariants: {
          $size: {
            $filter: { input: "$rows", as: "r", cond: { $and: ["$$r.tracked", { $lte: ["$$r.available", 0] }] } },
          },
        },
        lowStockVariants: {
          $size: {
            $filter: {
              input: "$rows",
              as: "r",
              cond: {
                $and: ["$$r.tracked", { $gt: ["$$r.available", 0] }, { $lte: ["$$r.available", "$$r.threshold"] }],
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        // Worst-status partition — a product is never "out" and "low" at
        // once, which is what makes `out + low + ok + onRequest === all`
        // hold for the chip counts below.
        status: {
          $switch: {
            branches: [
              { case: { $eq: [{ $size: "$stockVariants" }, 0] }, then: "on_request" },
              { case: { $gt: ["$outOfStockVariants", 0] }, then: "out" },
              { case: { $gt: ["$lowStockVariants", 0] }, then: "low" },
            ],
            default: "ok",
          },
        },
      },
    },
    {
      $facet: {
        rows: [
          ...statusMatch,
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
          { $lookup: { from: Brand.collection.name, localField: "brand", foreignField: "_id", as: "brandDoc" } },
          {
            $lookup: {
              from: CategoryModel.collection.name,
              localField: "category",
              foreignField: "_id",
              as: "categoryDoc",
            },
          },
          {
            $project: {
              _id: 0,
              itemId: { $toString: "$_id" },
              name: 1,
              brand: { $ifNull: [{ $arrayElemAt: ["$brandDoc.name", 0] }, ""] },
              categoryName: { $ifNull: [{ $arrayElemAt: ["$categoryDoc.name", 0] }, ""] },
              gallery: 1,
              variantCount: 1,
              untrackedVariantCount: 1,
              totalAvailable: 1,
              totalOnHand: 1,
              totalReserved: 1,
              outOfStockVariants: 1,
              lowStockVariants: 1,
              status: 1,
            },
          },
        ],
        // Same match as `rows`, without `$sort`/`$skip`/`$limit` — the exact
        // total for `meta.pages`, not an estimate off the page size.
        total: [...statusMatch, { $count: "value" }],
        // Deliberately *without* `statusMatch` — the chip counts describe the
        // whole filtered set regardless of which chip is currently selected,
        // so picking "Bajos" doesn't also zero out the "Agotados" count.
        counts: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
      },
    },
  ]).exec();

  const rawRows = facetResult?.rows ?? [];
  const total = facetResult?.total[0]?.value ?? 0;

  const counts: AdminInventoryProductCounts = { all: 0, out: 0, low: 0, ok: 0, onRequest: 0 };
  for (const entry of facetResult?.counts ?? []) {
    if (entry._id === "out") counts.out = entry.n;
    else if (entry._id === "low") counts.low = entry.n;
    else if (entry._id === "ok") counts.ok = entry.n;
    else if (entry._id === "on_request") counts.onRequest = entry.n;
  }
  counts.all = counts.out + counts.low + counts.ok + counts.onRequest;

  const products: AdminInventoryProductRow[] = rawRows.map((row) => {
    // Sorted here, not in the pipeline: keeps this module clear of
    // `$sortArray` (Mongo 5.2+) for a value this cheap to sort once the page
    // — at most `limit` products — is already in memory, the same "join
    // after the page" tradeoff the two `$lookup`s above already accepted.
    const gallery = [...row.gallery].sort((a, b) => a.order - b.order);
    return {
      itemType,
      itemId: row.itemId,
      name: row.name,
      brand: row.brand,
      categoryName: row.categoryName,
      ...(gallery[0]?.url ? { imageUrl: gallery[0].url } : {}),
      variantCount: row.variantCount,
      untrackedVariantCount: row.untrackedVariantCount,
      totalAvailable: row.totalAvailable,
      totalOnHand: row.totalOnHand,
      totalReserved: row.totalReserved,
      outOfStockVariants: row.outOfStockVariants,
      lowStockVariants: row.lowStockVariants,
      status: row.status,
    };
  });

  return { products, counts, meta: buildMeta(total, page, limit) };
}

/**
 * Every active variant of one product, including the ones with no
 * `InventoryItem` row yet — what the product modal renders, grouped by
 * `color` on the client. A 404 here also covers `itemType` pointing at the
 * wrong catalog: the id simply won't resolve against that model.
 */
async function getProductDetail(itemType: ItemType, itemId: string): Promise<AdminInventoryProductDetail> {
  const Product = CATALOG_MODELS[itemType];

  const product = await Product.findOne({ _id: itemId, isActive: true, archivedAt: null })
    .select("name brand category gallery variants")
    .populate("brand", "name")
    .populate("category", "name")
    .lean()
    .exec();

  if (!product) {
    throw new AppError(`${ITEM_TYPE_LABELS[itemType]} no encontrado.`, 404);
  }

  const { inventory } = await settingsService.get();

  const stockRows = await InventoryItem.find({ itemType, itemId: product._id }).lean().exec();
  const stockBySku = new Map(stockRows.map((row) => [row.sku, row]));

  const activeVariants = product.variants.filter((variant) => variant.isActive);
  const variants: AdminInventoryVariantRow[] = activeVariants.map((variant) => {
    const row = stockBySku.get(variant.sku);
    return {
      inventoryItemId: row ? String(row._id) : null,
      sku: variant.sku,
      ...(variant.size ? { size: variant.size } : {}),
      ...(variant.color ? { color: variant.color } : {}),
      fulfillmentMode: variant.fulfillmentMode,
      onHand: row?.onHand ?? 0,
      reserved: row?.reserved ?? 0,
      available: row ? row.onHand - row.reserved : 0,
      lowStockThresholdUnits: row?.lowStockThreshold ?? inventory.lowStockThresholdUnits,
      ...(row?.lastRestockedAt ? { lastRestockedAt: row.lastRestockedAt.toISOString() } : {}),
    };
  });

  const brandDoc = product.brand as unknown as { name: string } | null;
  const categoryDoc = product.category as unknown as { name: string } | null;
  const gallery = [...product.gallery].sort((a, b) => a.order - b.order);

  return {
    itemType,
    itemId: String(product._id),
    name: product.name,
    brand: brandDoc?.name ?? "",
    categoryName: categoryDoc?.name ?? "",
    ...(gallery[0]?.url ? { imageUrl: gallery[0].url } : {}),
    variants,
  };
}

export const inventoryProductsService = { listProducts, getProductDetail };
