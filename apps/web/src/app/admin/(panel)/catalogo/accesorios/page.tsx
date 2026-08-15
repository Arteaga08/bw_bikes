import type { AdminBrand } from "@bw-bikes/shared";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverApiFetch } from "@/lib/api/server";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { CatalogView } from "../CatalogView";

export default async function AccesoriosPage() {
  const [treeResult, brandsResult] = await Promise.all([
    serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/accessory-categories/tree"),
    serverApiFetch<{ brands: AdminBrand[] }>("/admin/brands?limit=100&sort=name"),
  ]);

  return (
    <>
      <PageHeader
        title="Accesorios"
        subtitle="Catálogo de accesorios — ficha técnica libre, variantes y galería por producto."
        actions={
          <ButtonLink href="/admin/catalogo/accesorios/nueva" variant="primary" className="w-full sm:w-auto">
            Nuevo accesorio
          </ButtonLink>
        }
      />
      <CatalogView kind="accessory" categoryTree={treeResult.data.tree} brands={brandsResult.data.brands} />
    </>
  );
}
