import type { OperationalAlerts } from "@bw-bikes/shared";
import { Application, Order } from "../../models/index.js";
import { alertThreshold, reconciliationThreshold } from "../order.service.js";
import { settingsService } from "../settings.service.js";
import { countOutOfStockSkus } from "./inventory.stats.js";

/**
 * Operational alerts — deliberately **not** windowed. See
 * `packages/shared/src/types/stats.ts`'s `OperationalAlerts` doc comment for
 * why: an order stuck waiting on the supplier doesn't stop being stuck
 * because the admin filtered the dashboard to "last 7 days". This function
 * takes no `StatsRange` on purpose, so that mistake is impossible to make by
 * construction rather than by discipline.
 *
 * The two clock-based alerts reuse `order.service.ts`'s own
 * `alertThreshold`/`reconciliationThreshold` — the exact thresholds the
 * background jobs act on — so this reads as "what the jobs would flag on
 * their next tick", not a second, independently-drifting definition of
 * "stuck". `countOutOfStockSkus` is likewise imported rather than
 * reimplemented, from `inventory.stats.ts`.
 */
export async function getOperationalAlerts(now: Date = new Date()): Promise<OperationalAlerts> {
  const { orders } = await settingsService.get();

  const [awaitingSupplierConfirmation, expiringAuthorizations, staleUnpaidOrders, pendingApplications, outOfStockSkus] =
    await Promise.all([
      Order.countDocuments({ status: "awaiting_supplier_confirmation" }).exec(),
      Order.countDocuments({
        status: { $in: ["authorized", "awaiting_supplier_confirmation"] },
        "payment.authorizedAt": { $lte: alertThreshold(now, orders.orderAuthAlertHours) },
      }).exec(),
      Order.countDocuments({
        status: "pending_payment",
        "payment.intentId": { $exists: true },
        createdAt: { $lte: reconciliationThreshold(now, orders.paymentReconciliationAfterMinutes) },
      }).exec(),
      Application.countDocuments({ status: "pending" }).exec(),
      countOutOfStockSkus(),
    ]);

  return { awaitingSupplierConfirmation, expiringAuthorizations, staleUnpaidOrders, pendingApplications, outOfStockSkus };
}
