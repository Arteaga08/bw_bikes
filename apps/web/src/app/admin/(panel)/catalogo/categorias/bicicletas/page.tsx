import { serverApiFetch } from "@/lib/api/server";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { CategoriesView } from "../CategoriesView";

export default async function CategoriasBicicletasPage() {
  const { data } = await serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/bike-categories/tree");

  return <CategoriesView kind="bike" initialTree={data.tree} />;
}
