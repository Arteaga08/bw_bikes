"use client";

import type { ColorTemplate } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import type { ColorTemplateInput } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { cn } from "@/lib/cn";

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export interface ColorFormModalApi {
  create: (input: ColorTemplateInput) => Promise<ColorTemplate>;
  update: (id: string, input: Partial<ColorTemplateInput>) => Promise<ColorTemplate>;
}

export interface ColorFormModalProps {
  api: ColorFormModalApi;
  onClose: () => void;
  onSaved: () => void;
  initial?: ColorTemplate;
}

/**
 * Create/edit form for a color template — same shape as `SizeFormModal` plus
 * a `hex` field. A validated text `Input` (not `<input type="color">`): this
 * component's label/error/helper wiring and focus-ring styling are built
 * around a text-like control, and a native color picker's OS-chrome can't
 * represent an in-progress invalid string the way a regex-checked `Input`
 * does. The swatch beside it gives the same visual confirmation instead.
 * `hex` is always required through this form, even when editing an
 * auto-learned entry that started life with `hex: null` — the nullable case
 * only exists for a color nobody has opened this modal for yet.
 */
export function ColorFormModal({ api, onClose, onSaved, initial }: ColorFormModalProps) {
  const { toast } = useToast();
  const [value, setValue] = useState(initial?.value ?? "");
  const [hex, setHex] = useState(initial?.hex ?? "");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ value?: string; hex?: string }>({});

  const isValidHex = HEX_PATTERN.test(hex);

  async function handleSubmit(): Promise<void> {
    const nextErrors: { value?: string; hex?: string } = {};
    if (!value.trim()) nextErrors.value = "El color es obligatorio.";
    if (!isValidHex) nextErrors.hex = "Captura un hexadecimal válido (#RRGGBB).";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const input: ColorTemplateInput = {
        value: value.trim(),
        hex,
        order: Number.parseInt(order, 10) || 0,
        isActive,
      };
      if (initial) await api.update(initial.id, input);
      else await api.create(input);
      toast({ variant: "success", title: initial ? "Cambios guardados" : "Color creado" });
      onSaved();
      onClose();
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo guardar el color",
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
      title={initial ? "Editar color" : "Nuevo color"}
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
          label="Color"
          required
          placeholder="p. ej. Negro mate"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          error={errors.value}
        />
        <div className="flex items-end gap-sm">
          <Input
            label="Hex"
            required
            placeholder="#3B82F6"
            value={hex}
            onChange={(event) => setHex(event.target.value)}
            error={errors.hex}
            wrapperClassName="min-w-0 flex-1"
          />
          <span
            aria-hidden="true"
            className={cn("mb-0.5 h-9 w-9 shrink-0 rounded-full border", isValidHex ? "border-borde" : "border-dashed border-grafito")}
            style={isValidHex ? { backgroundColor: hex } : undefined}
          />
        </div>
        <Input label="Orden" type="number" min={0} value={order} onChange={(event) => setOrder(event.target.value)} />
        <Toggle label="Activa" checked={isActive} onChange={setIsActive} />
      </div>
    </Modal>
  );
}
