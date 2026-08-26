import type {
  AdminCustomerCouponSummary,
  AdminCustomerDetail,
  AdminCustomerOrderSummary,
  AdminCustomerSummary,
} from "@bw-bikes/shared";
import type { PipelineStage } from "mongoose";
import { CouponRedemption, Order, User } from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery } from "../utils/index.js";
import { REVENUE_STATUSES } from "./stats/orders.stats.js";

const SORTABLE_FIELDS = ["createdAt", "orderCount", "totalSpentCents", "lastOrderAt"] as const;

/** The drawer is a summary, not the orders screen — both lists are bounded. */
const MAX_RECENT_ORDERS = 10;
const MAX_REDEEMED_COUPONS = 20;

/**
 * "Compró" and "gastó" are two different questions, and they need two
 * different status sets — the same split `preferences.stats.ts` documents.
 *
 * A refunded order still means this person bought from the shop, so it counts
 * toward `orderCount` and toward being a repeat buyer. It is not money the
 * shop kept, so it must not count toward `totalSpentCents`. Collapsing the two
 * would either hide real customers or inflate their lifetime value.
 */
const PURCHASE_STATUSES = [...REVENUE_STATUSES, "refunded"];

/** Kept in lockstep with `orders.stats.ts` by importing `REVENUE_STATUSES` rather than restating it. */
const IS_REVENUE_EXPR = {
  $and: [{ $in: ["$status", REVENUE_STATUSES] }, { $ne: ["$disputeStatus", "lost"] }],
};

interface CustomerAggregateRow {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt: Date;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: Date | null;
}

function toSummary(row: CustomerAggregateRow): AdminCustomerSummary {
  return {
    id: String(row._id),
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    emailVerified: row.emailVerified,
    orderCount: row.orderCount,
    totalSpentCents: row.totalSpentCents,
    ...(row.lastOrderAt ? { lastOrderAt: row.lastOrderAt.toISOString() } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The `$lookup` that turns a user into a customer record.
 *
 * Driven from `User` rather than from `Order` so a registered customer who
 * never bought still appears — "quién se registró y no ha comprado" is a real
 * question, and grouping orders would erase exactly those people.
 *
 * The sub-pipeline filters inside the lookup, so Mongo can use
 * `{userId, createdAt}` on `Order` instead of pulling every order into memory
 * and discarding most of them afterwards.
 */
const ORDER_LOOKUP: PipelineStage[] = [
  {
    $lookup: {
      from: "orders",
      let: { userId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$userId", "$$userId"] }, status: { $in: PURCHASE_STATUSES } } },
        {
          $group: {
            _id: null,
            orderCount: { $sum: 1 },
            totalSpentCents: { $sum: { $cond: [IS_REVENUE_EXPR, "$totalCents", 0] } },
            lastOrderAt: { $max: "$createdAt" },
          },
        },
      ],
      as: "orderStats",
    },
  },
  {
    $addFields: {
      orderCount: { $ifNull: [{ $first: "$orderStats.orderCount" }, 0] },
      totalSpentCents: { $ifNull: [{ $first: "$orderStats.totalSpentCents" }, 0] },
      lastOrderAt: { $ifNull: [{ $first: "$orderStats.lastOrderAt" }, null] },
    },
  },
  { $project: { orderStats: 0, password: 0, twoFactor: 0, emailVerification: 0, passwordReset: 0 } },
];

interface ListOptions {
  /** "Quién ha comprado más de una vez" — the segment worth a coupon. */
  repeatBuyersOnly?: boolean;
  /** Excludes registered accounts that never bought. */
  buyersOnly?: boolean;
}

async function list(query: Record<string, unknown>) {
  const { page, limit, skip, sort, search } = parseListQuery(query, {
    allowedSortFields: SORTABLE_FIELDS,
    defaultSort: "-totalSpentCents",
  });

  const options: ListOptions = {
    repeatBuyersOnly: query["repeatBuyersOnly"] === true,
    buyersOnly: query["buyersOnly"] === true,
  };

  // Only ever customers: staff accounts are not a CRM segment, and listing
  // them here would put admin emails on a screen built for outreach.
  const match: Record<string, unknown> = { role: "customer" };
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    match["$or"] = [{ email: pattern }, { firstName: pattern }, { lastName: pattern }];
  }

  // Applied after the lookup because `orderCount` does not exist before it.
  const postMatch: Record<string, unknown> = {};
  if (options.repeatBuyersOnly) postMatch["orderCount"] = { $gte: 2 };
  else if (options.buyersOnly) postMatch["orderCount"] = { $gte: 1 };

  const pipeline: PipelineStage[] = [
    { $match: match },
    ...ORDER_LOOKUP,
    ...(Object.keys(postMatch).length > 0 ? [{ $match: postMatch }] : []),
  ];

  // `$facet` so the page and its count come from **one** pass over the same
  // pipeline. Running the lookup twice — once to page, once to count — would
  // double the cost of the most expensive query on this screen.
  const [result] = await User.aggregate<{ rows: CustomerAggregateRow[]; total: { count: number }[] }>([
    ...pipeline,
    {
      $facet: {
        rows: [{ $sort: sort as Record<string, 1 | -1> }, { $skip: skip }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    },
  ]).exec();

  const rows = result?.rows ?? [];
  const total = result?.total[0]?.count ?? 0;

  return { documents: rows.map(toSummary), meta: buildMeta(total, page, limit) };
}

async function getDetail(userId: string): Promise<AdminCustomerDetail> {
  const [row] = await User.aggregate<CustomerAggregateRow>([
    { $match: { role: "customer", $expr: { $eq: [{ $toString: "$_id" }, userId] } } },
    ...ORDER_LOOKUP,
  ]).exec();

  if (!row) {
    throw new AppError("Cliente no encontrado.", 404);
  }

  const [orders, redemptions] = await Promise.all([
    Order.find({ userId })
      .sort({ createdAt: -1 })
      .limit(MAX_RECENT_ORDERS)
      .select("orderNumber status totalCents createdAt")
      .lean()
      .exec(),
    CouponRedemption.find({ userId }).sort({ createdAt: -1 }).limit(MAX_REDEEMED_COUPONS).lean().exec(),
  ]);

  const recentOrders: AdminCustomerOrderSummary[] = orders.map((order) => ({
    id: String(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    totalCents: order.totalCents,
    createdAt: order.createdAt.toISOString(),
  }));

  // The order number is what an operator can search for; the redemption only
  // stores an id, so it is resolved from the orders already in hand where
  // possible and left blank rather than triggering a second round of queries.
  const orderNumbers = new Map(orders.map((order) => [String(order._id), order.orderNumber]));

  const redeemedCoupons: AdminCustomerCouponSummary[] = redemptions.map((redemption) => ({
    id: String(redemption._id),
    code: redemption.code,
    orderNumber: orderNumbers.get(String(redemption.orderId)) ?? "—",
    discountCents: redemption.discountCents,
    createdAt: redemption.createdAt.toISOString(),
  }));

  const summary = toSummary(row);

  return {
    ...summary,
    recentOrders,
    redeemedCoupons,
    averageOrderCents: summary.orderCount > 0 ? Math.round(summary.totalSpentCents / summary.orderCount) : 0,
  };
}

export const customerService = { list, getDetail };
