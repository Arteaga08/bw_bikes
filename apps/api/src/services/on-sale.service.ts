import type { IAccessory, IBike } from "../models/index.js";
import { buildMeta, parseListQuery } from "../utils/index.js";
import { accessoryService } from "./accessory.service.js";
import { bikeService } from "./bike.service.js";
import { SORT_ALIASES, SORTABLE_FIELDS } from "./product.service.js";

/**
 * Per-catalog ceiling for `listAllMatching` below — generous enough to cover
 * a real bike shop's on-sale inventory with wide margin. A true
 * cross-collection paginated read (Mongo's `$unionWith`) would scale
 * further, but `Bike` and `Accessory` are queried through two independent
 * `buildFilter` closures (each bound to its own category tree) — folding
 * both into one aggregation pipeline is complexity this catalog's real size
 * doesn't call for.
 */
const ON_SALE_FETCH_CAP = 300;

type OnSaleRow = { kind: "bike"; doc: IBike } | { kind: "accessory"; doc: IAccessory };

/**
 * Compares two rows field by field per `sort` (the same `Record<string, 1|-1>`
 * shape `parseListQuery` hands `.sort()` elsewhere) — `Bike` and `Accessory`
 * are separate Mongoose models, so there's no single query for Mongo to sort
 * this merge with; it happens here instead, over the fields every product
 * carries regardless of catalog (`createdAt`, `price`, `name`, and the
 * boolean flags `SORT_ALIASES` compounds against).
 */
function compareBySort(sort: Record<string, 1 | -1>) {
  return (a: OnSaleRow, b: OnSaleRow): number => {
    const left = a.doc as unknown as Record<string, unknown>;
    const right = b.doc as unknown as Record<string, unknown>;

    for (const [field, direction] of Object.entries(sort)) {
      const leftValue = left[field];
      const rightValue = right[field];

      let comparison = 0;
      if (leftValue instanceof Date && rightValue instanceof Date) {
        comparison = leftValue.getTime() - rightValue.getTime();
      } else if (typeof leftValue === "number" && typeof rightValue === "number") {
        comparison = leftValue - rightValue;
      } else if (typeof leftValue === "boolean" && typeof rightValue === "boolean") {
        comparison = Number(leftValue) - Number(rightValue);
      } else {
        comparison = String(leftValue).localeCompare(String(rightValue));
      }

      if (comparison !== 0) return comparison * direction;
    }
    return 0;
  };
}

export interface OnSaleListResult {
  bikes: IBike[];
  accessories: IAccessory[];
  /** This page's real interleaved order — bikes and accessories travel back as their own arrays (same DTOs the plain catalog endpoints ship), so this is what lets the storefront grid render them back in the right sequence. */
  order: Array<{ kind: "bike" | "accessory"; id: string }>;
  meta: ReturnType<typeof buildMeta>;
}

/**
 * The merged "Ofertas" listing: bikes and accessories that actually carry a
 * discount (`onSale: true`, resolved by `buildFilter` in
 * `product.service.ts`), combined into one sorted, paginated result. Fetches
 * up to `ON_SALE_FETCH_CAP` matches from each catalog (already
 * filtered/sorted server-side by `listAllMatching`), merges and re-sorts them
 * in memory with the request's real `sort`, then slices the requested page —
 * see `ON_SALE_FETCH_CAP`'s own comment for why this stays in-memory instead
 * of a cross-collection aggregate.
 */
async function listOnSale(query: Record<string, unknown>): Promise<OnSaleListResult> {
  const { page, limit, sort } = parseListQuery(query, {
    allowedSortFields: SORTABLE_FIELDS,
    defaultSort: "-createdAt",
    sortAliases: SORT_ALIASES,
  });

  const scopedQuery = { ...query, onSale: true };

  const [bikes, accessories] = await Promise.all([
    bikeService.listAllMatching(scopedQuery, { publicOnly: true }, ON_SALE_FETCH_CAP),
    accessoryService.listAllMatching(scopedQuery, { publicOnly: true }, ON_SALE_FETCH_CAP),
  ]);

  const rows: OnSaleRow[] = [
    ...bikes.map((doc): OnSaleRow => ({ kind: "bike", doc })),
    ...accessories.map((doc): OnSaleRow => ({ kind: "accessory", doc })),
  ];
  rows.sort(compareBySort(sort));

  const skip = (page - 1) * limit;
  const pageRows = rows.slice(skip, skip + limit);

  return {
    bikes: pageRows.filter((row): row is { kind: "bike"; doc: IBike } => row.kind === "bike").map((row) => row.doc),
    accessories: pageRows
      .filter((row): row is { kind: "accessory"; doc: IAccessory } => row.kind === "accessory")
      .map((row) => row.doc),
    order: pageRows.map((row) => ({ kind: row.kind, id: String(row.doc._id) })),
    // `rows.length` is the true total as long as neither catalog's on-sale
    // count exceeds `ON_SALE_FETCH_CAP` — the same assumption `listAllMatching`
    // already makes to build `rows` in the first place, so this can't drift
    // from what a shopper can actually page through.
    meta: buildMeta(rows.length, page, limit),
  };
}

export const onSaleService = { listOnSale };
