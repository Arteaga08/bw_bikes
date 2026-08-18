import type { OperationalAlerts } from "@bw-bikes/shared";
import { Handshake, Package, Truck, Warning } from "@phosphor-icons/react/ssr";
import { AlertCard } from "@/components/ui/AlertCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import { HomeStats } from "./HomeStats";

/**
 * Inicio is the accionable half of the two Inicio/Analítica screens: alerts
 * fetched server-side, unwindowed (`GET /admin/stats/alerts` never takes a
 * date range — an order stuck waiting on the supplier doesn't stop being
 * stuck because you filtered to "hoy"), then the day's KPI pulse below.
 * Analítica is the other half — the full-period corte histórico.
 */
export default async function AdminHomePage() {
  const { data } = await serverApiFetch<{ alerts: OperationalAlerts }>("/admin/stats/alerts");
  const { alerts } = data;

  return (
    <>
      <PageHeader title="Inicio" subtitle="Resumen operativo del día." />
      <div className="flex flex-col gap-lg p-md sm:p-lg">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
          <AlertCard
            icon={Truck}
            label="Pedidos entrantes"
            count={alerts.awaitingSupplierConfirmation}
            href="/admin/ordenes"
            tone={alerts.awaitingSupplierConfirmation > 0 ? "advertencia" : "neutral"}
          />
          <AlertCard
            icon={Package}
            label="Stock agotado"
            count={alerts.outOfStockSkus}
            href="/admin/inventario"
            tone={alerts.outOfStockSkus > 0 ? "error" : "neutral"}
          />
          <AlertCard
            icon={Warning}
            label="Problemas con órdenes"
            count={alerts.expiringAuthorizations + alerts.staleUnpaidOrders}
            href="/admin/ordenes"
            tone={alerts.expiringAuthorizations + alerts.staleUnpaidOrders > 0 ? "error" : "neutral"}
          />
          <AlertCard
            icon={Handshake}
            label="Solicitudes pendientes"
            count={alerts.pendingApplications}
            href="/admin/solicitudes"
            tone={alerts.pendingApplications > 0 ? "advertencia" : "neutral"}
          />
        </div>

        <HomeStats />
      </div>
    </>
  );
}
