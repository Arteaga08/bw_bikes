"use client";

import type { CustomerFit, GearSizeCategory } from "@bw-bikes/shared";
import { GEAR_SIZE_CATEGORIES, GEAR_SIZE_CATEGORY_LABELS } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GearSizeForm } from "./GearSizeForm";

export interface GearSizesCardProps {
  fit: CustomerFit;
  onSaved: (fit: CustomerFit) => void;
}

/** Two-column grid, one row per equipment category — value or "Añadir talla +" per the reference (`00-CONTEXTO.md`). Editing a row opens `GearSizeForm` for that single category. */
export function GearSizesCard({ fit, onSaved }: GearSizesCardProps) {
  const [editingCategory, setEditingCategory] = useState<GearSizeCategory | null>(null);
  const valueByCategory = new Map(fit.gearSizes.map((size) => [size.category, size.value]));

  return (
    <>
      <div className="grid gap-md sm:grid-cols-2">
        {GEAR_SIZE_CATEGORIES.map((category) => {
          const value = valueByCategory.get(category);
          return (
            <div key={category} className="flex items-center justify-between gap-sm border-b border-borde pb-sm">
              <div>
                <p className="font-ui text-ui text-negro">{GEAR_SIZE_CATEGORY_LABELS[category]}</p>
                {value ? <p className="mt-xs font-body text-body text-grafito">{value}</p> : null}
              </div>
              {value ? (
                <Button variant="text" tone="neutral" onClick={() => setEditingCategory(category)}>
                  Editar
                </Button>
              ) : (
                <Button variant="text" tone="neutral" onClick={() => setEditingCategory(category)}>
                  Añadir talla +
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {editingCategory ? (
        <GearSizeForm
          fit={fit}
          category={editingCategory}
          initialValue={valueByCategory.get(editingCategory)}
          onClose={() => setEditingCategory(null)}
          onSaved={onSaved}
        />
      ) : null}
    </>
  );
}
