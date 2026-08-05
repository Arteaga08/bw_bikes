import type { ItemType } from "./catalog.js";
import type { OrderStatus } from "./order.js";

/**
 * The admin stats panel (M7). Every module endpoint (`/admin/stats/orders`,
 * `/inventory`, `/applications`, `/preferences`) and the composed
 * `/admin/stats/overview` share **one** resolved date window per request —
 * `parseStatsRange` on the API side — so two charts on the same panel can
 * never silently disagree about what "last 7 days" means.
 *
 * `custom` is only reachable by supplying both `from` and `to` explicitly;
 * every other preset is computed server-side from `now`.
 */
export type StatsPreset = "today" | "7d" | "30d" | "90d" | "custom";

export interface StatsRange {
  preset: StatsPreset;
  /** ISO 8601, inclusive. */
  from: string;
  /** ISO 8601, exclusive. */
  to: string;
}

/** Every module response echoes the range it was computed over, for the overview's own consistency check. */
export interface OrdersStats {
  range: StatsRange;
  countsByStatus: Partial<Record<OrderStatus, number>>;
  /** Cents captured within the window — only statuses that represent money actually taken. */
  revenueCents: number;
  averageOrderValueCents: number;
  ordersByDay: { date: string; count: number }[];
}

export interface InventoryStats {
  range: StatsRange;
  /** Units committed (sold) within the window — leaving the warehouse, not merely reserved. */
  unitsCommitted: number;
  /**
   * Current facts, not filtered by the window — a stockout today doesn't
   * become less true because the admin is looking at last month's chart.
   */
  outOfStockSkus: number;
  lowStockSkus: number;
}

export interface ApplicationsStats {
  range: StatsRange;
  submitted: number;
  approved: number;
  rejected: number;
}

/** One ranked product: a model, not a variant — sizes are ranked separately. */
export interface PreferenceProductRanking {
  itemType: ItemType;
  itemId: string;
  name: string;
  brand: string;
  count: number;
}

export interface PreferenceSizeRanking {
  size: string;
  count: number;
}

/**
 * "Most viewed" comes from the anonymous `ProductView` event stream;
 * "most sold" comes straight from `Order.lines`, the order module's own
 * immutable snapshot — so this never has to read the catalog to group a sale.
 * There is no "discipline" dimension: the whole catalog is cycling, so a
 * per-discipline ranking would carry no information.
 */
export interface PreferencesStats {
  range: StatsRange;
  mostViewedModels: PreferenceProductRanking[];
  mostViewedSizes: PreferenceSizeRanking[];
  mostSoldModels: PreferenceProductRanking[];
  mostSoldSizes: PreferenceSizeRanking[];
}

/**
 * Operational alerts, deliberately **not** windowed — an order stuck waiting
 * on the supplier doesn't stop being stuck because the admin filtered the
 * dashboard to "last 7 days". See `stats/alerts.stats.ts`.
 */
export interface OperationalAlerts {
  /** Orders currently sitting in the supplier-confirmation queue. */
  awaitingSupplierConfirmation: number;
  /** Orders whose authorization is close enough to trip the admin-alert threshold. */
  expiringAuthorizations: number;
  /** `pending_payment` orders old enough that the reconciliation job would already have looked at them. */
  staleUnpaidOrders: number;
  pendingApplications: number;
  outOfStockSkus: number;
}

/** The composed panel: one shared range, every module's payload, plus the unwindowed alerts. */
export interface StatsOverview {
  range: StatsRange;
  orders: OrdersStats;
  inventory: InventoryStats;
  applications: ApplicationsStats;
  preferences: PreferencesStats;
  alerts: OperationalAlerts;
}
