import { PageHeader } from "@/components/ui/PageHeader";
import { SpecTemplatesView } from "./SpecTemplatesView";

export default function FichasTecnicasPage() {
  return (
    <>
      <PageHeader
        title="Fichas técnicas"
        subtitle="Plantillas reutilizables — un título y sus etiquetas, sin valores — que el editor de producto ofrece al armar una ficha técnica."
      />
      <SpecTemplatesView />
    </>
  );
}
