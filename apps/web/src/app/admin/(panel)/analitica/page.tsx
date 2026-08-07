import { ChartBar } from "@phosphor-icons/react/ssr";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function AnaliticaPage() {
  return (
    <PlaceholderPage
      title="Analítica"
      subtitle="Ventas, preferencias de modelos/tallas y alertas operativas, con ventana de fechas compartida."
      icon={ChartBar}
      milestone="M11"
    />
  );
}
