import type { AdminSettings } from "@bw-bikes/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import { SettingsView } from "./SettingsView";

export default async function ConfiguracionPage() {
  const { data } = await serverApiFetch<{ settings: AdminSettings }>("/admin/settings");

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle="Inventario, órdenes, precios, envíos, solicitudes y jobs — editable por sección, sin pisar las demás."
      />
      <SettingsView initial={data.settings} />
    </>
  );
}
