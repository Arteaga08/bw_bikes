"use client";

import type { CustomerFit, GearSizeCategory } from "@bw-bikes/shared";
import { GEAR_SIZE_CATEGORY_LABELS } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { setAccountFit } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";

export interface GearSizeFormProps {
  fit: CustomerFit;
  category: GearSizeCategory;
  initialValue?: string;
  onClose: () => void;
  onSaved: (fit: CustomerFit) => void;
}

const MAX_VALUE_LENGTH = 20;

/** Small single-field modal to add/edit one equipment size category — replaces that category's entry in `fit.gearSizes` and sends the whole `fit` document, same full-replace pattern as `FitForm`. */
export function GearSizeForm({ fit, category, initialValue, onClose, onSaved }: GearSizeFormProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("La talla es obligatoria.");
      return;
    }
    if (trimmed.length > MAX_VALUE_LENGTH) {
      setError(`La talla no puede exceder ${MAX_VALUE_LENGTH} caracteres.`);
      return;
    }

    const gearSizes = [...fit.gearSizes.filter((size) => size.category !== category), { category, value: trimmed }];

    setError(null);
    setSubmitting(true);
    try {
      const next = await setAccountFit({ ...fit, gearSizes });
      onSaved(next);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la talla.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={GEAR_SIZE_CATEGORY_LABELS[category]}
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
      <Input
        label="Talla"
        placeholder="M, 42, 54cm…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={error ?? undefined}
      />
    </Modal>
  );
}
