import type { OperationalAlerts } from "@bw-bikes/shared";
import type { Icon } from "@phosphor-icons/react";
import { ReceiptX, ShoppingCart, Timer, Truck, Package, Handshake } from "@phosphor-icons/react/ssr";

export interface AlertDescriptor {
  key: keyof OperationalAlerts;
  icon: Icon;
  label: string;
  count: number;
  href: string;
  tone: "advertencia" | "error";
}

/**
 * The single classification of `OperationalAlerts` into icon/label/href/tone —
 * shared by `OperationsStrip` (Inicio) and `NotificationsPopover` (the
 * TopBar bell), so the two never disagree about what a count means or what
 * color it gets. Ordered by operational urgency, most costly first: an
 * authorization about to lapse loses a captured payment outright; a
 * stockout blocks every sale of that SKU; a stale unpaid order and a stuck
 * supplier confirmation are both recoverable without money moving; a new
 * paid order just needs to be picked up; a pending application is the least
 * time-sensitive of the six.
 */
export function buildAlertDescriptors(alerts: OperationalAlerts): AlertDescriptor[] {
  return [
    {
      key: "expiringAuthorizations",
      icon: Timer,
      label: "Autorizaciones por vencer",
      count: alerts.expiringAuthorizations,
      href: "/admin/ordenes",
      tone: "error",
    },
    {
      key: "outOfStockSkus",
      icon: Package,
      label: "Stock agotado",
      count: alerts.outOfStockSkus,
      href: "/admin/inventario",
      tone: "error",
    },
    {
      key: "staleUnpaidOrders",
      icon: ReceiptX,
      label: "Pagos sin conciliar",
      count: alerts.staleUnpaidOrders,
      href: "/admin/ordenes",
      tone: "advertencia",
    },
    {
      key: "awaitingSupplierConfirmation",
      icon: Truck,
      label: "Pedidos entrantes",
      count: alerts.awaitingSupplierConfirmation,
      href: "/admin/ordenes",
      tone: "advertencia",
    },
    {
      key: "newOrders",
      icon: ShoppingCart,
      label: "Ventas nuevas",
      count: alerts.newOrders,
      href: "/admin/ordenes",
      tone: "advertencia",
    },
    {
      key: "pendingApplications",
      icon: Handshake,
      label: "Solicitudes pendientes",
      count: alerts.pendingApplications,
      href: "/admin/solicitudes",
      tone: "advertencia",
    },
  ];
}
