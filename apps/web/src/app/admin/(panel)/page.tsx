import { House } from "@phosphor-icons/react/ssr";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function AdminHomePage() {
  return (
    <PlaceholderPage
      title="Inicio"
      subtitle="Resumen operativo del día — la ventana de fechas compartida entre módulos ya existe en el backend (M7)."
      icon={House}
      milestone="M11"
    />
  );
}
