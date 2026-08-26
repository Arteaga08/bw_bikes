import type { PriceCents } from "./catalog.js";

/**
 * A customer as the admin list shows them.
 *
 * Every aggregate here is **derived from `Order` at read time**, never stored
 * on the user. Denormalising `orderCount`/`totalSpentCents` onto `User` would
 * mean a second place that can disagree with the orders — and the two would
 * drift the first time an order is refunded, disputed, or cancelled. The
 * `{userId, createdAt}` index on `Order` is what makes reading them cheap.
 *
 * The money rule matches the rest of the panel exactly (`orders.stats.ts`):
 * `totalSpentCents` counts `paid`/`processing`/`shipped`/`delivered` and
 * excludes anything refunded or lost to a chargeback, so this figure and the
 * revenue chart can never tell different stories about the same customer.
 */
export interface AdminCustomerSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  /** Purchases that count as sales — refunds included, since they did buy. */
  orderCount: number;
  /** Money the shop actually kept. Refunded and charged-back orders excluded. */
  totalSpentCents: PriceCents;
  /** Absent for a registered customer who never bought. */
  lastOrderAt?: string;
  /** When the account was created. */
  createdAt: string;
}

/** One of the customer's purchases, trimmed to what the detail drawer lists. */
export interface AdminCustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: PriceCents;
  createdAt: string;
}

/** One coupon this customer has redeemed. */
export interface AdminCustomerCouponSummary {
  id: string;
  code: string;
  orderNumber: string;
  discountCents: PriceCents;
  createdAt: string;
}

export interface AdminCustomerDetail extends AdminCustomerSummary {
  /** Most recent first, bounded — the drawer is a summary, not the orders screen. */
  recentOrders: AdminCustomerOrderSummary[];
  redeemedCoupons: AdminCustomerCouponSummary[];
  /** Mean of the orders that counted toward `totalSpentCents`. `0` when they never bought. */
  averageOrderCents: PriceCents;
}

/** A row of the "mejores compradores" ranking. */
export interface TopBuyerRow {
  userId: string;
  name: string;
  email: string;
  orderCount: number;
  totalSpentCents: PriceCents;
  lastOrderAt: string;
}

/**
 * The headline numbers above the customer list.
 *
 * `repeatBuyers` is the "quién ha comprado más de una vez" the shop asked
 * for — the segment worth sending a coupon to.
 */
export interface CustomersStats {
  totalCustomers: number;
  buyers: number;
  repeatBuyers: number;
  averageOrderCents: PriceCents;
  topBuyers: TopBuyerRow[];
}
