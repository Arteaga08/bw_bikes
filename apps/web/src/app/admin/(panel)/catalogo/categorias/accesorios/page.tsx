import { serverApiFetch } from "@/lib/api/server";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { CategoriesView } from "../CategoriesView";

export default async function CategoriasAccesoriosPage() {
  const { data } = await serverApiFetch<{ tree: CategoryTreeNode[] }>("/admin/accessory-categories/tree");

  return <CategoriesView kind="accessory" initialTree={data.tree} />;
}
