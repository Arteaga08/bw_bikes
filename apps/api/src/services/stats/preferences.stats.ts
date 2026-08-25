import type {
  ItemType,
  PreferenceProductRanking,
  PreferenceSizeRanking,
  PreferencesStats,
  StatsRange,
} from "@bw-bikes/shared";
import { Accessory, Bike, Order, ProductView } from "../../models/index.js";
import { IS_REVENUE_EXPR } from "./orders.stats.js";

/**
 * Rankings, not a full list: a panel widget shows a top-N, and letting it
 * grow unbounded would turn a merchandising chart into a full table scan.
 */
const MAX_RANKING_ITEMS = 10;

/**
 * Statuses that represent a real sale for the purposes of "most sold" —
 * broader than `orders.stats.ts`'s `REVENUE_STATUSES`. A refunded order
 * still tells the merchandiser something was in demand; it is a revenue
 * question, not a popularity one, so it counts here even though it doesn't
 * count toward revenue.
 */
const SOLD_STATUSES = ["paid", "processing", "shipped", "delivered", "refunded"];

interface ProductGroupRow {
  _id: { itemType: ItemType; itemId: string };
  count: number;
  name: string;
  brand: string;
  revenueCents: number;
}

interface SizeGroupRow {
  _id: string;
  count: number;
}

interface ViewGroupRow {
  _id: { itemType: ItemType; itemId: string };
  count: number;
}

function windowFilter(range: StatsRange, field: string) {
  return { [field]: { $gte: new Date(range.from), $lt: new Date(range.to) } };
}

/**
 * Sales come straight from `Order.lines` — the order module's own immutable
 * snapshot (M5). This never reads the catalog: `name`/`brand` are already
 * frozen on every line, so a renamed or later-archived product still ranks
 * correctly against historical sales.
 */
async function getMostSoldModels(range: StatsRange): Promise<PreferenceProductRanking[]> {
  const rows = await Order.aggregate<ProductGroupRow>([
    { $match: { status: { $in: SOLD_STATUSES }, ...windowFilter(range, "createdAt") } },
    { $unwind: "$lines" },
    {
      $group: {
        _id: { itemType: "$lines.itemType", itemId: "$lines.itemId" },
        count: { $sum: "$lines.qty" },
        name: { $first: "$lines.name" },
        brand: { $first: "$lines.brand" },
        // Same rule as `orders.stats.ts`'s `revenueCents`: a refunded sale, or
        // one lost to a chargeback, still counts toward `count`
        // (popularity), but not toward revenue — the money came back or left
        // for good. Imported, not re-declared, so this can never drift from
        // the KPI figure above it on Inicio.
        revenueCents: { $sum: { $cond: [IS_REVENUE_EXPR, "$lines.lineTotalCents", 0] } },
      },
    },
    { $sort: { count: -1 } },
    { $limit: MAX_RANKING_ITEMS },
  ]).exec();

  return rows.map((row) => ({
    itemType: row._id.itemType,
    itemId: row._id.itemId,
    name: row.name,
    brand: row.brand,
    count: row.count,
    revenueCents: row.revenueCents,
  }));
}

async function getMostSoldSizes(range: StatsRange): Promise<PreferenceSizeRanking[]> {
  const rows = await Order.aggregate<SizeGroupRow>([
    { $match: { status: { $in: SOLD_STATUSES }, ...windowFilter(range, "createdAt") } },
    { $unwind: "$lines" },
    { $match: { "lines.size": { $exists: true, $ne: null } } },
    { $group: { _id: "$lines.size", count: { $sum: "$lines.qty" } } },
    { $sort: { count: -1 } },
    { $limit: MAX_RANKING_ITEMS },
  ]).exec();

  return rows.map((row) => ({ size: row._id, count: row.count }));
}

/**
 * `ProductView` carries no name/brand (kept deliberately minimal — see the
 * model). This is the one place preferences.stats.ts touches the catalog:
 * a bounded (`MAX_RANKING_ITEMS`) batch lookup, at most two queries — one per
 * catalog — the same pattern `order-pricing.ts`'s `loadProducts` uses.
 */
async function resolveProductLabels(
  rows: { itemType: ItemType; itemId: string; count: number }[],
): Promise<PreferenceProductRanking[]> {
  const bikeIds = rows.filter((row) => row.itemType === "bike").map((row) => row.itemId);
  const accessoryIds = rows.filter((row) => row.itemType === "accessory").map((row) => row.itemId);

  // `.lean()`: only plain fields are read below (`bike.brand`/`accessory.brand`
  // cast directly, never checked via `.populated()`) — populate still
  // resolves normally on a lean query.
  const [bikes, accessories] = await Promise.all([
    bikeIds.length > 0
      ? Bike.find({ _id: { $in: bikeIds } }, "name brand").populate("brand", "name").lean().exec()
      : Promise.resolve([]),
    accessoryIds.length > 0
      ? Accessory.find({ _id: { $in: accessoryIds } }, "name brand").populate("brand", "name").lean().exec()
      : Promise.resolve([]),
  ]);

  const labels = new Map<string, { name: string; brand: string }>();
  for (const bike of bikes) {
    labels.set(`bike:${String(bike._id)}`, { name: bike.name, brand: (bike.brand as unknown as { name: string }).name });
  }
  for (const accessory of accessories) {
    labels.set(`accessory:${String(accessory._id)}`, {
      name: accessory.name,
      brand: (accessory.brand as unknown as { name: string }).name,
    });
  }

  const ranked: PreferenceProductRanking[] = [];
  for (const row of rows) {
    // A viewed product later hard-deleted would have no label — doesn't
    // happen in practice (products are archived, never hard-deleted), but a
    // dropped row is safer here than a ranking entry with no name to show.
    const label = labels.get(`${row.itemType}:${row.itemId}`);
    if (!label) continue;
    ranked.push({ itemType: row.itemType, itemId: row.itemId, name: label.name, brand: label.brand, count: row.count });
  }
  return ranked;
}

async function getMostViewedModels(range: StatsRange): Promise<PreferenceProductRanking[]> {
  const rows = await ProductView.aggregate<ViewGroupRow>([
    { $match: windowFilter(range, "occurredAt") },
    { $group: { _id: { itemType: "$itemType", itemId: "$itemId" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: MAX_RANKING_ITEMS },
  ]).exec();

  return resolveProductLabels(
    rows.map((row) => ({ itemType: row._id.itemType, itemId: String(row._id.itemId), count: row.count })),
  );
}

async function getMostViewedSizes(range: StatsRange): Promise<PreferenceSizeRanking[]> {
  const rows = await ProductView.aggregate<SizeGroupRow>([
    { $match: { ...windowFilter(range, "occurredAt"), size: { $exists: true, $ne: null } } },
    { $group: { _id: "$size", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: MAX_RANKING_ITEMS },
  ]).exec();

  return rows.map((row) => ({ size: row._id, count: row.count }));
}

/**
 * No "discipline" ranking: the catalog is entirely cycling, so a
 * per-discipline breakdown carries no information — models and sizes are
 * the two dimensions that actually distinguish demand here.
 */
export async function getPreferencesStats(range: StatsRange): Promise<PreferencesStats> {
  const [mostViewedModels, mostViewedSizes, mostSoldModels, mostSoldSizes] = await Promise.all([
    getMostViewedModels(range),
    getMostViewedSizes(range),
    getMostSoldModels(range),
    getMostSoldSizes(range),
  ]);

  return { range, mostViewedModels, mostViewedSizes, mostSoldModels, mostSoldSizes };
}
