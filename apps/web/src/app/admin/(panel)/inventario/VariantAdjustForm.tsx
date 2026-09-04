"use client";

import type { AdminInventoryVariantRow } from "@bw-bikes/shared";
import { ArrowDown, ArrowUp, ClipboardText } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

const MAX_REASON_LENGTH = 200;

export interface VariantAdjustFormProps {
  variant: AdminInventoryVariantRow;
  /** `reason` is `undefined`, never an empty string, when Motivo is left blank — the caller omits the key entirely so the request matches what a click on the stepper sends. */
  onSubmit: (input: { delta: number } | { onHand: number }, reason: string | undefined) => void | Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

type AdjustMode = "in" | "out" | "absolute";

/**
 * `StockAdjustDialog`'s body, ported without its `Modal` shell — nesting two
 * `Modal`s (this form inline inside `ProductInventoryModal`'s already-open
 * one) would double up the Escape handler and the focus trap, so this
 * renders directly inside the variant row instead of opening on top of it.
 *
 * Motivo is optional here, matching what the backend always allowed
 * (`adjustStockSchema`'s `reason` is `.optional()`) — the previous version of
 * this form required it client-side for audit legibility, which is exactly
 * the friction the redesign was asked to remove for a same-day store sale
 * that has no "motivo" beyond "se vendió".
 */
export function VariantAdjustForm({ variant, onSubmit, onCancel, submitting }: VariantAdjustFormProps) {
  const [mode, setMode] = useState<AdjustMode>("in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const amountId = useId();

  const parsedAmount = Number.parseInt(amount, 10);
  const isAmountValid = amount.trim() !== "" && Number.isInteger(parsedAmount) && parsedAmount > 0;
  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length <= MAX_REASON_LENGTH;
  const isValid = isAmountValid && isReasonValid;

  const showAmountError = (amountTouched || submitAttempted) && !isAmountValid;
  const amountError = showAmountError
    ? amount.trim() === ""
      ? "Ingresa un número de unidades."
      : "Debe ser un número entero mayor a 0."
    : undefined;

  const reasonError = submitAttempted && !isReasonValid ? `Máximo ${MAX_REASON_LENGTH} caracteres.` : undefined;

  async function handleSubmit(): Promise<void> {
    setSubmitAttempted(true);
    if (!isValid) return;
    const input = mode === "absolute" ? { onHand: parsedAmount } : { delta: mode === "in" ? parsedAmount : -parsedAmount };
    await onSubmit(input, trimmedReason.length > 0 ? trimmedReason : undefined);
  }

  const preview =
    isAmountValid
      ? (() => {
          const newOnHand = mode === "absolute" ? parsedAmount : variant.onHand + (mode === "in" ? parsedAmount : -parsedAmount);
          const newAvailable = newOnHand - variant.reserved;
          return `Quedarán ${newAvailable} disponibles (${newOnHand} en bodega).`;
        })()
      : undefined;

  return (
    <div className="flex flex-col gap-md rounded-control bg-inset p-md">
      <div className="flex flex-col gap-xs">
        <span className="font-ui text-ui text-negro">¿Qué pasó?</span>
        <ButtonGroup label="Tipo de ajuste">
          <Button type="button" variant={mode === "in" ? "secondary" : "bare"} size="sm" onClick={() => setMode("in")}>
            <span className="inline-flex items-center gap-1">
              <ArrowUp size={14} weight="bold" aria-hidden="true" />
              Entraron
            </span>
          </Button>
          <Button type="button" variant={mode === "out" ? "secondary" : "bare"} size="sm" onClick={() => setMode("out")}>
            <span className="inline-flex items-center gap-1">
              <ArrowDown size={14} weight="bold" aria-hidden="true" />
              Salieron
            </span>
          </Button>
          <Button type="button" variant={mode === "absolute" ? "secondary" : "bare"} size="sm" onClick={() => setMode("absolute")}>
            <span className="inline-flex items-center gap-1">
              <ClipboardText size={14} weight="bold" aria-hidden="true" />
              Recuento físico
            </span>
          </Button>
        </ButtonGroup>
      </div>

      <Input
        id={amountId}
        label={mode === "absolute" ? "Nuevo stock físico" : "Unidades"}
        inputMode="numeric"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        onBlur={() => setAmountTouched(true)}
        error={amountError}
        helper={!amountError ? preview : undefined}
      />

      <Textarea
        label="Motivo (opcional)"
        rows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="p. ej. Venta en tienda física"
        error={reasonError}
        helper={!reasonError ? `${trimmedReason.length}/${MAX_REASON_LENGTH} caracteres` : undefined}
      />

      <div className="flex justify-end gap-sm">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" loading={submitting} onClick={() => void handleSubmit()}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
