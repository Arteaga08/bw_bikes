"use client";

import type { PublicAccessory } from "@bw-bikes/shared";
import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CloseButton } from "@/components/ui/CloseButton";
import { Input } from "@/components/ui/Input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToast } from "@/hooks/use-toast";
import type { CategoryTreeNode } from "@/lib/api/admin-catalog";
import { adminAccessoriesApi } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { cn } from "@/lib/cn";

/** Mirrors `MAX_RELATED_ACCESSORIES` in `apps/api/src/models/bike.model.ts`. */
export const MAX_RELATED_ACCESSORIES = 12;

const SEARCH_DEBOUNCE_MS = 300;
/** A category's whole catalog fits in one page here — this is a curation picker, not a paginated list. */
const CATEGORY_PAGE_SIZE = 50;

export interface RelatedAccessoriesPickerProps {
  selected: PublicAccessory[];
  onChange: (selected: PublicAccessory[]) => void;
  /** Accessory-categories tree — drives the browse-by-category accordion shown while the search box is empty. */
  categoryTree: CategoryTreeNode[];
}

interface FlatCategory {
  id: string;
  label: string;
}

/** Flattens the two-level tree to "Padre" and "Padre › Hijo" sections — same convention as `ProductOrganizationFields`' `flattenCategoryOptions`. */
function flattenCategories(tree: CategoryTreeNode[]): FlatCategory[] {
  return tree.flatMap((root) => [
    { id: root.id, label: root.name },
    ...root.children.map((child) => ({ id: child.id, label: `${root.name} › ${child.name}` })),
  ]);
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Bike-only cross-sell curation: browse the accessory catalog by category, or
 * search across all of it, and add up to 12; remove as chips. Search and the
 * category accordion are mutually exclusive views of the same picker — typing
 * a query flattens back to a single ranked list, clearing it returns to browse.
 */
export function RelatedAccessoriesPicker({ selected, onChange, categoryTree }: RelatedAccessoriesPickerProps) {
  const { toast } = useToast();
  const categories = useMemo(() => flattenCategories(categoryTree), [categoryTree]);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const [searchResults, setSearchResults] = useState<PublicAccessory[]>([]);
  const [searching, setSearching] = useState(false);

  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [categoryResults, setCategoryResults] = useState<Record<string, PublicAccessory[]>>({});
  const [loadingCategoryId, setLoadingCategoryId] = useState<string | null>(null);

  // Marks the fetch as in flight during render (React's documented pattern
  // for adjusting state on a prop/derived-value change — same trick
  // `ColoresView` uses for its own `loading` flag) rather than inside the
  // effect body below, which the lint rules forbid.
  const [lastQueried, setLastQueried] = useState<string | null>(null);
  if (debouncedQuery && debouncedQuery !== lastQueried) {
    setLastQueried(debouncedQuery);
    setSearching(true);
  }

  useEffect(() => {
    // Nothing to fetch — and no stale results to clear, since `isSearching`
    // below already keeps `searchResults` off-screen whenever this is empty.
    if (!debouncedQuery) return;

    let cancelled = false;
    adminAccessoriesApi
      .list({ search: debouncedQuery, limit: 10 })
      .then(({ data }) => {
        if (!cancelled) setSearchResults(data);
      })
      .catch((error) => {
        if (cancelled) return;
        toast({ variant: "error", title: "No se pudo buscar accesorios", description: apiErrorMessage(error, "Intenta de nuevo.") });
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, toast]);

  async function toggleCategory(categoryId: string): Promise<void> {
    if (openCategoryId === categoryId) {
      setOpenCategoryId(null);
      return;
    }
    setOpenCategoryId(categoryId);
    if (categoryResults[categoryId]) return;

    setLoadingCategoryId(categoryId);
    try {
      const { data } = await adminAccessoriesApi.list({ category: categoryId, limit: CATEGORY_PAGE_SIZE });
      setCategoryResults((current) => ({ ...current, [categoryId]: data }));
    } catch (error) {
      toast({ variant: "error", title: "No se pudieron cargar los accesorios", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setLoadingCategoryId(null);
    }
  }

  function addAccessory(accessory: PublicAccessory): void {
    if (selected.some((item) => item.id === accessory.id) || selected.length >= MAX_RELATED_ACCESSORIES) return;
    onChange([...selected, accessory]);
  }

  function removeAccessory(id: string): void {
    onChange(selected.filter((item) => item.id !== id));
  }

  function renderRow(accessory: PublicAccessory, showCategory: boolean) {
    const alreadySelected = selected.some((item) => item.id === accessory.id);
    return (
      <li key={accessory.id} className="flex items-center justify-between gap-sm rounded-control border border-borde px-md py-sm">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-body text-body text-negro">{accessory.name}</span>
          {showCategory ? <span className="font-body text-caption text-grafito">{accessory.category.name}</span> : null}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={alreadySelected || selected.length >= MAX_RELATED_ACCESSORIES}
          onClick={() => addAccessory(accessory)}
        >
          {alreadySelected ? "Agregado" : "Agregar"}
        </Button>
      </li>
    );
  }

  const isSearching = debouncedQuery.length > 0;

  return (
    <div className="flex flex-col gap-md">
      <Input
        label="Buscar accesorio"
        placeholder="p. ej. Casco, luces, candado"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {isSearching ? (
        searching ? (
          <p className="font-body text-caption text-grafito">Buscando…</p>
        ) : searchResults.length > 0 ? (
          <ul className="flex flex-col gap-xs">{searchResults.map((accessory) => renderRow(accessory, true))}</ul>
        ) : (
          <p className="font-body text-caption text-grafito">Sin resultados para &quot;{debouncedQuery}&quot;.</p>
        )
      ) : categories.length === 0 ? (
        <p className="font-body text-caption text-grafito">No hay categorías de accesorios todavía.</p>
      ) : (
        <div className="flex flex-col rounded-card border border-borde">
          {categories.map((category) => {
            const expanded = openCategoryId === category.id;
            const results = categoryResults[category.id];
            const loading = loadingCategoryId === category.id;
            return (
              <div key={category.id} className="border-b border-borde last:border-b-0">
                <button
                  type="button"
                  onClick={() => void toggleCategory(category.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-sm px-md py-sm text-left font-ui text-ui text-negro transition-colors duration-150 hover:bg-base"
                >
                  {category.label}
                  <CaretDown
                    aria-hidden="true"
                    size={16}
                    className={cn("shrink-0 transition-transform duration-200 ease-out-strong", expanded && "rotate-180")}
                  />
                </button>
                <div
                  inert={!expanded ? true : undefined}
                  className="grid transition-[grid-template-rows] duration-200 ease-out-strong"
                  style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="flex flex-col gap-xs px-md pb-sm">
                      {loading ? (
                        <p className="font-body text-caption text-grafito">Cargando…</p>
                      ) : results && results.length > 0 ? (
                        <ul className="flex flex-col gap-xs">{results.map((accessory) => renderRow(accessory, false))}</ul>
                      ) : results ? (
                        <p className="font-body text-caption text-grafito">Sin accesorios en esta categoría.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-sm">
        {selected.map((accessory) => (
          <span
            key={accessory.id}
            className="inline-flex items-center gap-xs rounded-control bg-inset px-sm py-1 font-ui text-caption text-negro"
          >
            {accessory.name}
            {/* `icon-sm` (20px): the default 36px square would set the chip's own height. */}
            <CloseButton size="icon-sm" aria-label={`Quitar ${accessory.name}`} onClick={() => removeAccessory(accessory.id)} />
          </span>
        ))}
      </div>
    </div>
  );
}
