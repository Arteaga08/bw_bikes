"use client";

import type { PublicAccessory } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/hooks/use-toast";
import { adminAccessoriesApi } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";

/** Mirrors `MAX_RELATED_ACCESSORIES` in `apps/api/src/models/bike.model.ts`. */
export const MAX_RELATED_ACCESSORIES = 12;

export interface RelatedAccessoriesPickerProps {
  selected: PublicAccessory[];
  onChange: (selected: PublicAccessory[]) => void;
}

/** Bike-only cross-sell curation: search the accessory catalog, add up to 12, remove as chips. */
export function RelatedAccessoriesPicker({ selected, onChange }: RelatedAccessoriesPickerProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicAccessory[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleSearch(): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await adminAccessoriesApi.list({ search: trimmed, limit: 10 });
      setResults(data);
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo buscar accesorios",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSearching(false);
    }
  }

  function addAccessory(accessory: PublicAccessory): void {
    if (selected.some((item) => item.id === accessory.id) || selected.length >= MAX_RELATED_ACCESSORIES) return;
    onChange([...selected, accessory]);
  }

  function removeAccessory(id: string): void {
    onChange(selected.filter((item) => item.id !== id));
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm">
        <Input
          label="Buscar accesorio"
          placeholder="p. ej. Casco, luces, candado"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void handleSearch();
          }}
        />
        <Button variant="secondary" loading={searching} onClick={() => void handleSearch()} className="self-start">
          Buscar
        </Button>
      </div>

      {results.length > 0 ? (
        <ul className="flex flex-col gap-xs">
          {results.map((accessory) => {
            const alreadySelected = selected.some((item) => item.id === accessory.id);
            return (
              <li
                key={accessory.id}
                className="flex items-center justify-between rounded-control border border-borde px-md py-sm"
              >
                <span className="font-body text-body text-negro">{accessory.name}</span>
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
          })}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-sm">
        {selected.map((accessory) => (
          <span
            key={accessory.id}
            className="inline-flex items-center gap-xs rounded-control bg-base px-sm py-1 font-ui text-caption text-negro"
          >
            {accessory.name}
            <button
              type="button"
              aria-label={`Quitar ${accessory.name}`}
              onClick={() => removeAccessory(accessory.id)}
              className="rounded-control text-grafito transition-colors duration-150 hover:text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
