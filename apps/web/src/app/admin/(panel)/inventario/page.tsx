import { Package } from "@phosphor-icons/react/ssr";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function InventarioPage() {
  return (
    <PlaceholderPage
      title="Inventario"
      subtitle="Stock disponible (onHand − reserved) y reservas anti-sobreventa."
      icon={Package}
      milestone="M11"
    />
  );
}
