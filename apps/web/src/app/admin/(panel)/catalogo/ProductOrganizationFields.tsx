"use client";

import type { AdminBrand } from "@bw-bikes/shared";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Select } from "@/components/ui/Select";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { PRODUCT_FIELD_IDS } from "./field-ids";
import type { ProductBasicsValue } from "./ProductBasicsSection";

export type { CategoryTreeNode };

/** Flattens the two-level tree to "Padre › Hijo" options — the root itself is always selectable too, not just a group label. */
function flattenCategoryOptions(tree: CategoryTreeNode[]): ComboboxOption[] {
  return tree.flatMap((root) => [
    { id: root.id, label: root.name },
    ...root.children.map((child) => ({ id: child.id, label: `${root.name} › ${child.name}` })),
  ]);
}

/** Finds a root or child node by id — used by `ProductEditor` to resolve the selected category's `usesSizes` before deciding whether to render `SizePicker`. */
export function findCategoryById(tree: CategoryTreeNode[], id: string): CategoryTreeNode | undefined {
  for (const root of tree) {
    if (root.id === id) return root;
    const child = root.children.find((candidate) => candidate.id === id);
    if (child) return { ...child, children: [] };
  }
  return undefined;
}

export interface ProductOrganizationFieldsProps {
  value: Pick<ProductBasicsValue, "brand" | "category">;
  onChange: (value: Pick<ProductBasicsValue, "brand" | "category">) => void;
  categoryTree: CategoryTreeNode[];
  /** Active brands only — the editor's page loader fetches `?isActive=true`, mirroring how the category tree only offers active nodes. */
  brands: AdminBrand[];
  errors?: Partial<Record<"brand" | "category", string>>;
}

/**
 * Marca y Categoría — how the catalog files a product, not what describes it.
 * Split out of `ProductBasicsSection` to live in the editor's right rail:
 * these two selects change rarely once set, so they don't need the same
 * scroll depth as name/description/price.
 */
export function ProductOrganizationFields({
  value,
  onChange,
  categoryTree,
  brands,
  errors = {},
}: ProductOrganizationFieldsProps) {
  return (
    <div className="flex flex-col gap-md">
      <Select
        id={PRODUCT_FIELD_IDS.brand}
        label="Marca"
        required
        value={value.brand}
        onChange={(event) => onChange({ ...value, brand: event.target.value })}
        error={errors.brand}
      >
        <option value="">Selecciona una marca</option>
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}
      </Select>

      <Combobox
        id={PRODUCT_FIELD_IDS.category}
        label="Categoría"
        required
        placeholder="Busca una categoría"
        value={value.category}
        onChange={(id) => onChange({ ...value, category: id })}
        options={flattenCategoryOptions(categoryTree)}
        error={errors.category}
      />
    </div>
  );
}
