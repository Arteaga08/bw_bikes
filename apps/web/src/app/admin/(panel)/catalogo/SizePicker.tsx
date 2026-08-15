"use client";

import type { SizeTemplate } from "@bw-bikes/shared";
import { Check } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { emptyVariantRow, MAX_VARIANTS, type VariantRow } from "./VariantsEditor";

export interface SizePickerProps {
  /** Saved sizes offered as chips — fetched server-side, same pattern as `brands`/`availableBadges`. */
  sizeTemplates: SizeTemplate[];
  variants: VariantRow[];
  onChange: (variants: VariantRow[]) => void;
}

function sizesInUse(variants: VariantRow[]): string[] {
  const seen = new Set<string>();
  const sizes: string[] = [];
  for (const variant of variants) {
    const size = variant.size.trim();
    if (!size || seen.has(size)) continue;
    seen.add(size);
    sizes.push(size);
  }
  return sizes;
}

/** Catalog values first, in their saved order, then any size already on a variant that isn't in the catalog yet — typed this session via "Nueva talla", or loaded from a product saved before this catalog existed. */
function buildChips(sizeTemplates: SizeTemplate[], variants: VariantRow[]): string[] {
  const chips = sizeTemplates
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((template) => template.value);

  const known = new Set(chips.map((value) => value.toLowerCase()));
  for (const size of sizesInUse(variants)) {
    if (known.has(size.toLowerCase())) continue;
    known.add(size.toLowerCase());
    chips.push(size);
  }
  return chips;
}

/**
 * "Tallas y variantes"' entry point: checking a chip creates that size's
 * first variant row (`VariantsEditor` renders the group underneath),
 * unchecking removes every row under it — guarded by a confirm step the
 * moment any of those rows already has a SKU, so a stray click can't
 * silently discard captured work. "Nueva talla" adds a size not yet in the
 * catalog; it's never posted to `/size-templates` from here — it only
 * becomes a reusable chip once the product saves and `learnSizeTemplates`
 * (M10.7 S1) picks it up, the same rule the ficha técnica's own templates
 * follow (learned from what's saved, not from what's typed).
 */
export function SizePicker({ sizeTemplates, variants, onChange }: SizePickerProps) {
  const [newSizeValue, setNewSizeValue] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const chips = buildChips(sizeTemplates, variants);
  const atLimit = variants.length >= MAX_VARIANTS;

  function isChecked(value: string): boolean {
    return variants.some((variant) => variant.size === value);
  }

  function addSize(value: string): void {
    if (atLimit) return;
    onChange([...variants, { ...emptyVariantRow(), size: value }]);
  }

  function removeSize(value: string): void {
    onChange(variants.filter((variant) => variant.size !== value));
  }

  function toggle(value: string): void {
    if (!isChecked(value)) {
      addSize(value);
      return;
    }
    const hasCapturedWork = variants.some((variant) => variant.size === value && variant.sku.trim() !== "");
    if (hasCapturedWork) {
      setPendingRemoval(value);
      return;
    }
    removeSize(value);
  }

  function handleAddNewSize(): void {
    const value = newSizeValue.trim();
    if (!value || atLimit || isChecked(value)) {
      setNewSizeValue("");
      return;
    }
    addSize(value);
    setNewSizeValue("");
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm">
        <span className="font-ui text-ui text-negro">Tallas</span>
        {chips.length === 0 ? (
          <p className="font-body text-caption text-grafito">No hay tallas guardadas todavía.</p>
        ) : (
          <div role="group" aria-label="Tallas del producto" className="flex flex-wrap gap-sm">
            {chips.map((value) => {
              const checked = isChecked(value);
              const disabled = !checked && atLimit;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  aria-pressed={checked}
                  onClick={() => toggle(value)}
                  className={cn(
                    "inline-flex items-center gap-xs rounded-control border px-sm py-xs font-ui text-ui",
                    "transition-colors duration-150",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
                    checked ? "border-negro bg-inset text-negro" : "border-borde text-grafito hover:border-grafito",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  {checked ? <Check aria-hidden="true" size={14} weight="bold" /> : null}
                  {value}
                </button>
              );
            })}
          </div>
        )}
        <ButtonLink href="/admin/catalogo/tallas" variant="text" className="self-start">
          Administrar tallas
        </ButtonLink>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-end">
        <Input
          label="Nueva talla"
          placeholder="p. ej. 54, M, 38 EU"
          value={newSizeValue}
          onChange={(event) => setNewSizeValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            handleAddNewSize();
          }}
          wrapperClassName="min-w-0 flex-1"
        />
        <Button
          variant="secondary"
          className="shrink-0"
          disabled={!newSizeValue.trim() || atLimit}
          onClick={handleAddNewSize}
        >
          Agregar talla
        </Button>
      </div>

      {atLimit ? (
        <p className="font-body text-caption text-estado-advertencia">
          Alcanzaste el máximo de {MAX_VARIANTS} variantes — quita alguna para agregar otra talla.
        </p>
      ) : null}

      <Modal
        open={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        title="Quitar talla"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingRemoval(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pendingRemoval) removeSize(pendingRemoval);
                setPendingRemoval(null);
              }}
            >
              Sí, quitar
            </Button>
          </>
        }
      >
        {pendingRemoval ? (
          <p>
            La talla «{pendingRemoval}» ya tiene SKU capturado. Si la quitas, se pierden sus variantes de esa talla.
            ¿Continuar?
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
