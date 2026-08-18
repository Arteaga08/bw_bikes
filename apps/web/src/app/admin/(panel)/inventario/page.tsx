import { PageHeader } from "@/components/ui/PageHeader";
import { InventarioView } from "./InventarioView";

export default function InventarioPage() {
  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle="Qué reponer, por categoría, con captura de entradas — el stock disponible que la tienda misma usa."
      />
      <InventarioView />
    </>
  );
}
