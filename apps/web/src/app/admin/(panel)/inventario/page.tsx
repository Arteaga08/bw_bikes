import type { AdminBrand } from "@bw-bikes/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { serverApiFetch } from "@/lib/api/server";
import { InventarioView } from "./InventarioView";

export default async function InventarioPage() {
  const [bikeTree, accessoryTree, brands] = await Promise.all([
    serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/bike-categories/tree"),
    serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/accessory-categories/tree"),
    serverApiFetch<{ brands: AdminBrand[] }>("/admin/brands?limit=100&sort=name"),
  ]);

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle="Qué reponer, por producto, con captura de entradas — el stock disponible que la tienda misma usa."
      />
      <InventarioView
        bikeCategoryTree={bikeTree.data.tree}
        accessoryCategoryTree={accessoryTree.data.tree}
        brands={brands.data.brands}
      />
    </>
  );
}
