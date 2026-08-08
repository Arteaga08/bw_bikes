import type { AdminSettings } from "@bw-bikes/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import { OrdersView } from "./OrdersView";

/**
 * Server Component: resolves `Settings.orders` once, server-side, so the
 * authorization countdown (`AuthorizationCountdown`) renders with real
 * thresholds on the very first paint instead of a client round-trip and a
 * layout shift once they arrive. `OrdersView` (client) owns everything that
 * actually changes after that — the order list, filters, and every action.
 */
export default async function OrdenesPage() {
  const { data } = await serverApiFetch<{ settings: AdminSettings }>("/admin/settings");
  const { orderAuthAlertHours, orderAuthCancelHours } = data.settings.orders;

  return (
    <>
      <PageHeader title="Órdenes" subtitle="Cola de confirmación de proveedor y seguimiento de pedidos." />
      <OrdersView orderAuthAlertHours={orderAuthAlertHours} orderAuthCancelHours={orderAuthCancelHours} />
    </>
  );
}
