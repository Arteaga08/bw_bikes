import { PageHeader } from "@/components/ui/PageHeader";
import { SolicitudesView } from "./SolicitudesView";

export default function SolicitudesPage() {
  return (
    <>
      <PageHeader title="Solicitudes" subtitle="Solicitudes de embajadores y patrocinios — flujo de aprobación." />
      <SolicitudesView />
    </>
  );
}
