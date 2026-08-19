"use client";

import type { ColorTemplate } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ColorSwatch } from "@/components/ui/ColorSwatch";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import type { ColorTemplateInput } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { HexPicker } from "./HexPicker";

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
 * `hex`/`secondaryHex`. `HexPicker` handles the actual color entry (curated
 * palette + native `<input type="color">` + a de-emphasized text fallback),
 * so this component only owns validation and the bicolor toggle. `hex` is
 * always required through this form, even when editing an auto-learned
 * entry that started life with `hex: null` — the nullable case only exists
 * for a color nobody has opened this modal for yet.
 */
export function ColorFormModal({ api, onClose, onSaved, initial }: ColorFormModalProps) {
  const { toast } = useToast();
  const [value, setValue] = useState(initial?.value ?? "");
  const [hex, setHex] = useState(initial?.hex ?? "");
  const [isBicolor, setIsBicolor] = useState(initial?.secondaryHex != null);
  const [secondaryHex, setSecondaryHex] = useState(initial?.secondaryHex ?? "");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ value?: string; hex?: string; secondaryHex?: string }>({});

  const isValidHex = HEX_PATTERN.test(hex);

  async function handleSubmit(): Promise<void> {
    const nextErrors: { value?: string; hex?: string; secondaryHex?: string } = {};
    if (!value.trim()) nextErrors.value = "El color es obligatorio.";
    if (!isValidHex) nextErrors.hex = "Captura un hexadecimal válido (#RRGGBB).";
    if (isBicolor && !HEX_PATTERN.test(secondaryHex)) {
      nextErrors.secondaryHex = "Captura un hexadecimal válido (#RRGGBB).";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const input: ColorTemplateInput = {
        value: value.trim(),
        hex,
        secondaryHex: isBicolor ? secondaryHex : null,
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
        <HexPicker label="Hex" value={hex} onChange={setHex} error={errors.hex} />
        <Toggle label="Es bicolor" checked={isBicolor} onChange={setIsBicolor} />
        {isBicolor ? (
          <HexPicker label="Segundo color" value={secondaryHex} onChange={setSecondaryHex} error={errors.secondaryHex} />
        ) : null}
        <div className="flex items-center gap-sm">
          <ColorSwatch hex={isValidHex ? hex : null} secondaryHex={isBicolor ? secondaryHex : null} className="h-9 w-9" />
          <span className="font-body text-caption text-grafito">Vista previa</span>
        </div>
        <Input label="Orden" type="number" min={0} value={order} onChange={(event) => setOrder(event.target.value)} />
        <Toggle label="Activa" checked={isActive} onChange={setIsActive} />
      </div>
    </Modal>
  );
}
