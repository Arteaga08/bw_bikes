"use client";

import type { SizeCategoryOverride, SizeTemplate } from "@bw-bikes/shared";
import { Trash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import { adminBikeCategoriesApi, type CategoryTreeNode, type SizeTemplateInput } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import type { SizesKind } from "./SizesView";

export interface SizeFormModalApi {
  create: (input: SizeTemplateInput) => Promise<SizeTemplate>;
  update: (id: string, input: Partial<SizeTemplateInput>) => Promise<SizeTemplate>;
}

export interface SizeFormModalProps {
  /** Either `adminBikeSizeTemplatesApi` or `adminAccessorySizeTemplatesApi` — picked by the caller, which already knows which catalog it's showing. */
  api: SizeFormModalApi;
  /** Gates the height-range fields below — the storefront size guide is bikes-only, so an accessory size stays exactly what it was: value + orden + activa. */
  kind: SizesKind;
  onClose: () => void;
  onSaved: () => void;
  initial?: SizeTemplate;
}

interface OverrideRow {
  /** Stable key for React list identity — a fresh row has no `categoryId` yet, so this can't reuse it. */
  key: string;
  categoryId: string;
  minHeightCm: string;
  maxHeightCm: string;
}

let overrideRowSeq = 0;
function newOverrideRow(override?: SizeCategoryOverride): OverrideRow {
  overrideRowSeq += 1;
  return {
    key: `row-${overrideRowSeq}`,
    categoryId: override?.categoryId ?? "",
    minHeightCm: override ? String(override.minHeightCm) : "",
    maxHeightCm: override ? String(override.maxHeightCm) : "",
  };
}

/** Root categories first, then their children indented — the same flattening a `<select>` needs since it can't render the tree's nesting any other way. */
function flattenCategoryOptions(tree: CategoryTreeNode[]): Array<{ id: string; label: string }> {
  return tree.flatMap((root) => [
    { id: root.id, label: root.name },
    ...root.children.map((child) => ({ id: child.id, label: `— ${child.name}` })),
  ]);
}

/**
 * Create/edit form for a size template — one level simpler than
 * `SpecTemplateFormModal`: a size is only ever its `value` (no sub-list of
 * fields to reorder), so there's no drag handle here, just the value plus
 * the same manual "Orden" number and "Activa" toggle the ficha técnica's
 * own templates use.
 *
 * Bike sizes carry two more things, both optional and both feeding the PDP's
 * "¿Cuál es mi talla?" / "Guía de tallas": a base rider-height range, and up
 * to `MAX_SIZE_CATEGORY_OVERRIDES` per-category exceptions to it (a mountain
 * "M" doesn't always fit the same height as a road "M"). Manuel's call,
 * 2026-08-31 — captured once here, not retyped per product.
 */
export function SizeFormModal({ api, kind, onClose, onSaved, initial }: SizeFormModalProps) {
  const { toast } = useToast();
  const [value, setValue] = useState(initial?.value ?? "");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [minHeightCm, setMinHeightCm] = useState(
    initial?.heightRange ? String(initial.heightRange.minHeightCm) : "",
  );
  const [maxHeightCm, setMaxHeightCm] = useState(
    initial?.heightRange ? String(initial.heightRange.maxHeightCm) : "",
  );
  const [overrides, setOverrides] = useState<OverrideRow[]>(
    () => initial?.categoryOverrides.map((override) => newOverrideRow(override)) ?? [],
  );
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    value?: string;
    heightRange?: string;
    overrides?: string;
  }>({});

  // Only bike sizes need the category picker — fetched once, not gated
  // behind opening the "Ajustes por categoría" section, so the section can
  // render its own empty/loading state without a second effect.
  useEffect(() => {
    if (kind !== "bike") return;
    let cancelled = false;
    adminBikeCategoriesApi
      .tree()
      .then((tree) => {
        if (!cancelled) setCategoryOptions(flattenCategoryOptions(tree));
      })
      .catch(() => {
        // Categories failing to load only disables adding new overrides —
        // existing ones (if any) still show by id and can still be removed.
        if (!cancelled) setCategoryOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  function addOverrideRow(): void {
    setOverrides((rows) => [...rows, newOverrideRow()]);
  }

  function removeOverrideRow(key: string): void {
    setOverrides((rows) => rows.filter((row) => row.key !== key));
  }

  function updateOverrideRow(key: string, patch: Partial<OverrideRow>): void {
    setOverrides((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors: { value?: string; heightRange?: string; overrides?: string } = {};
    if (!value.trim()) nextErrors.value = "La talla es obligatoria.";

    const minTrimmed = minHeightCm.trim();
    const maxTrimmed = maxHeightCm.trim();
    if ((minTrimmed || maxTrimmed) && (!minTrimmed || !maxTrimmed)) {
      nextErrors.heightRange = "Captura la estatura mínima y la máxima, o deja ambas vacías.";
    } else if (minTrimmed && maxTrimmed && Number(maxTrimmed) <= Number(minTrimmed)) {
      nextErrors.heightRange = "La estatura máxima debe ser mayor a la mínima.";
    }

    const categoryIdsUsed = new Set<string>();
    for (const row of overrides) {
      if (!row.categoryId || !row.minHeightCm.trim() || !row.maxHeightCm.trim()) {
        nextErrors.overrides = "Completa categoría, estatura mínima y máxima en cada ajuste, o quítalo.";
      } else if (Number(row.maxHeightCm) <= Number(row.minHeightCm)) {
        nextErrors.overrides = "La estatura máxima debe ser mayor a la mínima en cada ajuste.";
      } else if (categoryIdsUsed.has(row.categoryId)) {
        nextErrors.overrides = "Cada categoría solo puede tener un ajuste.";
      }
      categoryIdsUsed.add(row.categoryId);
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const input: SizeTemplateInput = {
        value: value.trim(),
        order: Number.parseInt(order, 10) || 0,
        isActive,
        heightRange:
          minTrimmed && maxTrimmed ? { minHeightCm: Number(minTrimmed), maxHeightCm: Number(maxTrimmed) } : null,
        categoryOverrides: overrides.map((row) => ({
          categoryId: row.categoryId,
          minHeightCm: Number(row.minHeightCm),
          maxHeightCm: Number(row.maxHeightCm),
        })),
      };
      if (initial) await api.update(initial.id, input);
      else await api.create(input);
      toast({ variant: "success", title: initial ? "Cambios guardados" : "Talla creada" });
      onSaved();
      onClose();
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo guardar la talla",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Editar talla" : "Nueva talla"}
      size={kind === "bike" ? "lg" : "md"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <Input
          label="Talla"
          required
          placeholder="p. ej. 54, M, 38 EU"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          error={errors.value}
        />
        <Input label="Orden" type="number" min={0} value={order} onChange={(event) => setOrder(event.target.value)} />
        <Toggle label="Activa" checked={isActive} onChange={setIsActive} />

        {kind === "bike" ? (
          <>
            <div className="border-t border-borde pt-md">
              <p className="font-ui text-ui text-negro">Estatura recomendada</p>
              <p className="mt-xs font-body text-caption text-grafito">
                Alimenta la guía de tallas y &quot;¿Cuál es mi talla?&quot; de la tienda. Déjalo vacío si aún no lo
                sabes — la talla simplemente no aparecerá ahí hasta que lo captures.
              </p>
              <div className="mt-sm flex gap-sm">
                <Input
                  label="Estatura desde (cm)"
                  type="number"
                  min={100}
                  max={230}
                  value={minHeightCm}
                  onChange={(event) => setMinHeightCm(event.target.value)}
                  wrapperClassName="flex-1"
                />
                <Input
                  label="Estatura hasta (cm)"
                  type="number"
                  min={100}
                  max={230}
                  value={maxHeightCm}
                  onChange={(event) => setMaxHeightCm(event.target.value)}
                  wrapperClassName="flex-1"
                />
              </div>
              {errors.heightRange ? (
                <p className="mt-xs font-body text-caption text-estado-error">{errors.heightRange}</p>
              ) : null}
            </div>

            <div className="border-t border-borde pt-md">
              <p className="font-ui text-ui text-negro">Ajustes por categoría</p>
              <p className="mt-xs font-body text-caption text-grafito">
                Opcional — cuando una categoría necesita un rango distinto al de arriba (p. ej. una &quot;M&quot; de
                montaña no es la misma estatura que una &quot;M&quot; de ruta).
              </p>

              <div className="mt-sm flex flex-col gap-sm">
                {overrides.map((row) => (
                  <div key={row.key} className="flex flex-col gap-sm rounded-control border border-borde p-sm sm:flex-row sm:items-end">
                    <Select
                      label="Categoría"
                      value={row.categoryId}
                      onChange={(event) => updateOverrideRow(row.key, { categoryId: event.target.value })}
                      wrapperClassName="min-w-0 flex-1"
                    >
                      <option value="">Selecciona una categoría</option>
                      {categoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Desde (cm)"
                      type="number"
                      min={100}
                      max={230}
                      value={row.minHeightCm}
                      onChange={(event) => updateOverrideRow(row.key, { minHeightCm: event.target.value })}
                      wrapperClassName="sm:w-28"
                    />
                    <Input
                      label="Hasta (cm)"
                      type="number"
                      min={100}
                      max={230}
                      value={row.maxHeightCm}
                      onChange={(event) => updateOverrideRow(row.key, { maxHeightCm: event.target.value })}
                      wrapperClassName="sm:w-28"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      tone="danger-strong"
                      aria-label="Quitar ajuste"
                      onClick={() => removeOverrideRow(row.key)}
                      iconLeft={<Trash aria-hidden="true" />}
                    />
                  </div>
                ))}
              </div>

              {errors.overrides ? (
                <p className="mt-xs font-body text-caption text-estado-error">{errors.overrides}</p>
              ) : null}

              <Button variant="secondary" size="sm" className="mt-sm" onClick={addOverrideRow}>
                Agregar ajuste
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
