import type { AdminBrand } from "@bw-bikes/shared";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { CatalogView } from "../CatalogView";

export default async function BicicletasPage() {
  const [treeResult, brandsResult] = await Promise.all([
    serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/bike-categories/tree"),
    serverApiFetch<{ brands: AdminBrand[] }>("/admin/brands?limit=100&sort=name"),
  ]);

  return (
    <>
      <PageHeader
        title="Bicicletas"
        subtitle="Catálogo de bicicletas — ficha técnica libre, variantes y galería por producto."
        actions={
          <Link href="/admin/catalogo/bicicletas/nueva" className="w-full sm:w-auto">
            <Button variant="primary" className="w-full sm:w-auto">
              Nueva bicicleta
            </Button>
          </Link>
        }
      />
      <CatalogView kind="bike" categoryTree={treeResult.data.tree} brands={brandsResult.data.brands} />
    </>
  );
}
