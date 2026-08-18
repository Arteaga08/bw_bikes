import { PageHeader } from "@/components/ui/PageHeader";
import { AuditLogView } from "./AuditLogView";

export default function AuditoriaPage() {
  return (
    <>
      <PageHeader title="Auditoría" subtitle="Bitácora de acciones administrativas — quién hizo qué, cuándo. Solo lectura." />
      <AuditLogView />
    </>
  );
}
