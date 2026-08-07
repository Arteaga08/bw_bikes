import { Gear } from "@phosphor-icons/react/ssr";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function ConfiguracionPage() {
  return (
    <PlaceholderPage
      title="Configuración"
      subtitle="Inventario, órdenes, precios, envíos, solicitudes y jobs — editable por sección, sin pisar las demás."
      icon={Gear}
      milestone="M11"
    />
  );
}
