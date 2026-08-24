import type { OperationalAlerts } from "@bw-bikes/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import { HomeStats } from "./HomeStats";
import { OperationsStrip } from "./OperationsStrip";
import { QuickLinks } from "./QuickLinks";

/**
 * Inicio is the accionable half of the two Inicio/Analítica screens: alerts
 * fetched server-side, unwindowed (`GET /admin/stats/alerts` never takes a
 * date range — an order stuck waiting on the supplier doesn't stop being
 * stuck because you filtered to "hoy"), then the day's business pulse below.
 * Analítica is the other half — the full-period corte histórico.
 */
export default async function AdminHomePage() {
  const { data } = await serverApiFetch<{ alerts: OperationalAlerts }>("/admin/stats/alerts");
  const { alerts } = data;

  return (
    <>
      <PageHeader title="Inicio" subtitle="Qué necesita tu atención hoy, y cómo va el negocio." />
      <div className="flex flex-col gap-lg p-md sm:p-lg">
        <QuickLinks alerts={alerts} />
        <OperationsStrip alerts={alerts} />
        <HomeStats />
      </div>
    </>
  );
}
