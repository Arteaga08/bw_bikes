"use client";

import type { CustomerFit, RideStyle } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { setAccountFit } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";
import { cn } from "@/lib/cn";
import { RIDE_STYLES } from "@/lib/ride-styles";

export interface FitFormProps {
  fit: CustomerFit;
  onClose: () => void;
  onSaved: (fit: CustomerFit) => void;
}

const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 230;

/** Height + ride style — same `PUT /account/fit` full-replace pattern as `BillingInfoForm`, keeping `gearSizes` untouched. */
export function FitForm({ fit, onClose, onSaved }: FitFormProps) {
  const [heightCm, setHeightCm] = useState<string>(fit.heightCm !== undefined ? String(fit.heightCm) : "");
  const [rideStyle, setRideStyle] = useState<RideStyle | undefined>(fit.rideStyle);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    const trimmed = heightCm.trim();
    const parsedHeight = trimmed ? Number(trimmed) : undefined;
    if (trimmed && (!Number.isFinite(parsedHeight) || parsedHeight! < MIN_HEIGHT_CM || parsedHeight! > MAX_HEIGHT_CM)) {
      setError(`La estatura debe estar entre ${MIN_HEIGHT_CM} y ${MAX_HEIGHT_CM} cm.`);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const next = await setAccountFit({ ...fit, heightCm: parsedHeight, rideStyle });
      onSaved(next);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar tu medida.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Tu medida"
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
          label="Estatura"
          type="number"
          inputMode="numeric"
          min={MIN_HEIGHT_CM}
          max={MAX_HEIGHT_CM}
          value={heightCm}
          onChange={(event) => setHeightCm(event.target.value)}
          helper={`${MIN_HEIGHT_CM}–${MAX_HEIGHT_CM} cm.`}
        />

        <div className="flex flex-col gap-sm">
          <span className="font-ui text-ui text-negro">Estilo de rodar</span>
          <div role="radiogroup" aria-label="Estilo de rodar" className="flex flex-col gap-sm">
            {RIDE_STYLES.map((option) => {
              const isSelected = option.value === rideStyle;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setRideStyle(option.value)}
                  className={cn(
                    "rounded-control border px-md py-sm text-left transition-colors duration-150",
                    isSelected ? "border-negro bg-negro text-blanco" : "border-borde text-negro hover:border-negro",
                  )}
                >
                  <span className="font-ui text-ui">{option.label}</span>
                  <p className={cn("mt-xs font-body text-caption", isSelected ? "text-blanco/70" : "text-grafito")}>
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="font-body text-caption text-estado-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
