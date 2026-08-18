import { PageHeader } from "@/components/ui/PageHeader";
import { AnaliticaView } from "./AnaliticaView";

export default function AnaliticaPage() {
  return (
    <>
      <PageHeader title="Analítica" subtitle="Ventas, preferencias de modelos y tallas, con ventana de fechas compartida." />
      <AnaliticaView />
    </>
  );
}
