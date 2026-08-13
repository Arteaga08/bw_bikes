import { PageHeader } from "@/components/ui/PageHeader";
import { BrandsView } from "./BrandsView";

export default function MarcasPage() {
  return (
    <>
      <PageHeader
        title="Marcas"
        subtitle="Una marca por fabricante, compartida entre bicicletas y accesorios — elígela al crear un producto en vez de escribirla cada vez."
      />
      <BrandsView />
    </>
  );
}
