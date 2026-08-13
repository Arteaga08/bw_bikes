"use client";

import type { SpecTemplate } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import { adminSpecTemplatesApi, type SpecTemplateInput } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { MAX_SPEC_FIELDS_PER_GROUP } from "@/lib/catalog/spec-groups";
import { slugify } from "@/lib/catalog/slugify";

export interface SpecTemplateFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  initial?: SpecTemplate;
}

interface FieldRow {
  label: string;
}

function fieldsFromTemplate(template?: SpecTemplate): FieldRow[] {
  return (template?.fields ?? []).map((field) => ({ label: field.label }));
}

function moveField(fields: FieldRow[], index: number, direction: -1 | 1): FieldRow[] {
  const target = index + direction;
  if (target < 0 || target >= fields.length) return fields;
  const next = [...fields];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved as FieldRow);
  return next;
}

/**
 * Create/edit form for a spec template — a title plus its labels, no
 * values (see `SpecTemplate`'s own doc comment). The label list reuses the
 * same up/down/remove/add shape as `SpecSheetEditor`'s field editor, minus
 * the "Valor" column that has no meaning here.
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

  function handleAddField(): void {
    const label = newLabel.trim();
    if (!label || fields.length >= MAX_SPEC_FIELDS_PER_GROUP) return;
    setFields([...fields, { label }]);
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
          {fields.length === 0 ? <p className="font-body text-caption text-grafito">Sin etiquetas todavía.</p> : null}
          {fields.map((field, index) => (
            <div key={index} className="flex items-end gap-sm">
              <Input
                label="Etiqueta"
                value={field.label}
                onChange={(event) =>
                  setFields(fields.map((row, rowIndex) => (rowIndex === index ? { label: event.target.value } : row)))
                }
                wrapperClassName="flex-1"
              />
              <Button variant="ghost" aria-label="Subir etiqueta" disabled={index === 0} onClick={() => setFields(moveField(fields, index, -1))}>
                ↑
              </Button>
              <Button
                variant="ghost"
                aria-label="Bajar etiqueta"
                disabled={index === fields.length - 1}
                onClick={() => setFields(moveField(fields, index, 1))}
              >
                ↓
              </Button>
              <Button variant="ghost" onClick={() => setFields(fields.filter((_, rowIndex) => rowIndex !== index))}>
                Eliminar
              </Button>
            </div>
          ))}

          <div className="flex items-end gap-sm">
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
              wrapperClassName="flex-1"
            />
            <Button variant="secondary" disabled={!newLabel.trim() || fields.length >= MAX_SPEC_FIELDS_PER_GROUP} onClick={handleAddField}>
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
