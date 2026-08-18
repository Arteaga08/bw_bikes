"use client";

import type { SizeTemplate } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import type { SizeTemplateInput } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";

export interface SizeFormModalApi {
  create: (input: SizeTemplateInput) => Promise<SizeTemplate>;
  update: (id: string, input: Partial<SizeTemplateInput>) => Promise<SizeTemplate>;
}

export interface SizeFormModalProps {
  /** Either `adminBikeSizeTemplatesApi` or `adminAccessorySizeTemplatesApi` — picked by the caller, which already knows which catalog it's showing. */
  api: SizeFormModalApi;
  onClose: () => void;
  onSaved: () => void;
  initial?: SizeTemplate;
}

/**
 * Create/edit form for a size template — one level simpler than
 * `SpecTemplateFormModal`: a size is only ever its `value` (no sub-list of
 * fields to reorder), so there's no drag handle here, just the value plus
 * the same manual "Orden" number and "Activa" toggle the ficha técnica's
 * own templates use.
 */
export function SizeFormModal({ api, onClose, onSaved, initial }: SizeFormModalProps) {
  const { toast } = useToast();
  const [value, setValue] = useState(initial?.value ?? "");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ value?: string }>({});

  async function handleSubmit(): Promise<void> {
    const nextErrors: { value?: string } = {};
    if (!value.trim()) nextErrors.value = "La talla es obligatoria.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const input: SizeTemplateInput = {
        value: value.trim(),
        order: Number.parseInt(order, 10) || 0,
        isActive,
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
      </div>
    </Modal>
  );
}
