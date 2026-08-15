"use client";

import type { SpecTemplate } from "@bw-bikes/shared";
import { DotsSixVertical, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { useToast } from "@/hooks/use-toast";
import { adminSpecTemplatesApi, type SpecTemplateInput } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { cn } from "@/lib/cn";
import { MAX_SPEC_FIELDS_PER_GROUP } from "@/lib/catalog/spec-groups";
import { slugify } from "@/lib/catalog/slugify";

export interface SpecTemplateFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  initial?: SpecTemplate;
}

interface FieldRow {
  /** Local to this form, never sent to the API — `handleSubmit` maps to `{ label, order: index }`. Exists so a drag reorder can key each row by identity instead of position: keyed by index, reordering remounts every input below the moved row and drops focus mid-drag. */
  id: string;
  label: string;
}

function fieldsFromTemplate(template?: SpecTemplate): FieldRow[] {
  return (template?.fields ?? []).map((field) => ({ id: crypto.randomUUID(), label: field.label }));
}

/** Same shape as `moveImage` (`lib/catalog/gallery.ts`): a target index, clamped rather than rejected, so both the pointer drag and the Arrow-key fallback can share one call. */
function moveField(fields: FieldRow[], from: number, to: number): FieldRow[] {
  const clampedTo = Math.min(Math.max(to, 0), fields.length - 1);
  if (from === clampedTo) return fields;
  const next = [...fields];
  const [moved] = next.splice(from, 1);
  next.splice(clampedTo, 0, moved as FieldRow);
  return next;
}

/**
 * Create/edit form for a spec template — a title plus its labels, no
 * values (see `SpecTemplate`'s own doc comment). Reordering is drag-only
 * (`useDragReorder`, pointer-based rather than the native HTML5 drag
 * `GallerySection`'s gallery still uses, so it also works with touch) —
 * no visible up/down buttons, just the handle plus its Arrow-key fallback.
 */
export function SpecTemplateFormModal({ onClose, onSaved, initial }: SpecTemplateFormModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [fields, setFields] = useState<FieldRow[]>(() => fieldsFromTemplate(initial));
  const [newLabel, setNewLabel] = useState("");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string }>({});

  const { draggingIndex, dropTargetIndex, registerRow, getHandleProps } = useDragReorder({
    itemCount: fields.length,
    onReorder: (from, to) => setFields((current) => moveField(current, from, to)),
  });

  function handleAddField(): void {
    const label = newLabel.trim();
    if (!label || fields.length >= MAX_SPEC_FIELDS_PER_GROUP) return;
    setFields([...fields, { id: crypto.randomUUID(), label }]);
    setNewLabel("");
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors: { title?: string } = {};
    if (!title.trim()) nextErrors.title = "El título es obligatorio.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const input: SpecTemplateInput = {
        title: title.trim(),
        fields: fields.map((field, index) => ({ label: field.label, order: index })),
        order: Number.parseInt(order, 10) || 0,
        isActive,
      };
      if (initial) await adminSpecTemplatesApi.update(initial.id, input);
      else await adminSpecTemplatesApi.create(input);
      toast({ variant: "success", title: initial ? "Cambios guardados" : "Plantilla creada" });
      onSaved();
      onClose();
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo guardar la plantilla",
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
      title={initial ? "Editar plantilla" : "Nueva plantilla"}
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
          label="Título"
          required
          placeholder="p. ej. Geometría"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={errors.title}
        />
        <Input label="Slug" helper="Se genera automáticamente del título." value={slugify(title)} disabled readOnly />

        <div className="flex flex-col gap-sm">
          <span className="font-ui text-ui text-negro">Etiquetas</span>
          {fields.length === 0 ? (
            <p className="font-body text-caption text-grafito">Sin etiquetas todavía.</p>
          ) : fields.length > 1 ? (
            <p className="font-body text-caption text-grafito">Arrastra para cambiar el orden.</p>
          ) : null}
          {fields.map((field, index) => (
            <div
              key={field.id}
              ref={registerRow(index)}
              className={cn(
                "flex items-end gap-sm rounded-control transition-opacity duration-150",
                draggingIndex === index && "opacity-50",
                dropTargetIndex === index && draggingIndex !== index && "outline-2 outline-offset-2 outline-negro",
              )}
            >
              <Button
                variant="bare"
                size="icon"
                aria-label="Reordenar etiqueta"
                className="shrink-0 cursor-grab touch-none"
                iconLeft={<DotsSixVertical />}
                {...getHandleProps(index)}
              />
              <Input
                label="Etiqueta"
                labelHidden
                value={field.label}
                onChange={(event) =>
                  setFields(fields.map((row, rowIndex) => (rowIndex === index ? { ...row, label: event.target.value } : row)))
                }
                wrapperClassName="min-w-0 flex-1"
              />
              <Button
                variant="bare"
                size="icon"
                tone="danger-strong"
                aria-label="Eliminar etiqueta"
                className="shrink-0"
                iconLeft={<Trash />}
                onClick={() => setFields(fields.filter((_, rowIndex) => rowIndex !== index))}
              />
            </div>
          ))}

          <div className="flex flex-col gap-sm sm:flex-row sm:items-end">
            <Input
              label="Nueva etiqueta"
              placeholder="p. ej. Talla"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                handleAddField();
              }}
              wrapperClassName="min-w-0 flex-1"
            />
            <Button
              variant="secondary"
              className="shrink-0"
              disabled={!newLabel.trim() || fields.length >= MAX_SPEC_FIELDS_PER_GROUP}
              onClick={handleAddField}
            >
              Agregar etiqueta
            </Button>
          </div>
        </div>

        <Input label="Orden" type="number" min={0} value={order} onChange={(event) => setOrder(event.target.value)} />
        <Toggle label="Activa" checked={isActive} onChange={setIsActive} />
      </div>
    </Modal>
  );
}
