import { PageHeader } from "@/components/ui/PageHeader";
import { BadgesView } from "./BadgesView";

export default function BadgesPage() {
  return (
    <>
      <PageHeader
        title="Badges"
        subtitle="Etiquetas de merchandising — Novedad, Bestseller — que un producto puede lucir en la ficha pública. Hasta 3 por producto."
      />
      <BadgesView />
    </>
  );
}
