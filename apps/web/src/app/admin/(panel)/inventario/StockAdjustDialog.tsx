"use client";

import type { AdminInventoryItem } from "@bw-bikes/shared";
import { ArrowDown, ArrowUp, ClipboardText } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

const MAX_REASON_LENGTH = 200;

export interface StockAdjustDialogProps {
  item: AdminInventoryItem | null;
  onClose: () => void;
  onConfirm: (input: { delta: number } | { onHand: number }, reason: string) => void | Promise<void>;
  submitting: boolean;
}

type AdjustMode = "in" | "out" | "absolute";

/**
 * One flat choice of three, not two nested ones — "Entraron"/"Salieron"
 * already *are* the delta mode, so there is no separate mode to pick first.
 * "Entraron"/"Salieron" is the default — how a shipment or a write-off is
 * actually counted, and it's safe under concurrency: if someone else
 * adjusted this row meanwhile, adding 5 is still correct. "Recuento físico"
 * is the second mode, for overwriting with a fresh physical count — mirrors
 * `adjustStockSchema`'s `.xor("onHand","delta")`.
 *
 * Two things fixed here after the previous round still read as "no sirve":
 * the "Guardar" button used to just sit disabled with zero explanation when
 * a field was missing — now every field shows its own error the moment it's
 * touched, not just a silent disabled button. And the amount had no
 * feedback on what it would actually do — now a preview line computes the
 * resulting count live, so a number that's clearly wrong (would go
 * negative, say) is visible before submitting, not after a 409.
 *
 * Motivo is required here even though the backend leaves it optional: it's
 * the only thing that makes the audit trail legible afterward — an
 * adjustment with no reason is a number that changed with no explanation.
 */
export function StockAdjustDialog({ item, onClose, onConfirm, submitting }: StockAdjustDialogProps) {
  const [mode, setMode] = useState<AdjustMode>("in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [reasonTouched, setReasonTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const amountId = useId();
  const reasonId = useId();

  function handleClose(): void {
    setMode("in");
    setAmount("");
    setReason("");
    setAmountTouched(false);
    setReasonTouched(false);
    setSubmitAttempted(false);
    onClose();
  }

  const parsedAmount = Number.parseInt(amount, 10);
  const isAmountValid = amount.trim() !== "" && Number.isInteger(parsedAmount) && parsedAmount > 0;
  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length > 0 && trimmedReason.length <= MAX_REASON_LENGTH;
  const isValid = isAmountValid && isReasonValid;

  const showAmountError = (amountTouched || submitAttempted) && !isAmountValid;
  const amountError = showAmountError
    ? amount.trim() === ""
      ? "Ingresa un número de unidades."
      : "Debe ser un número entero mayor a 0."
    : undefined;

  const showReasonError = (reasonTouched || submitAttempted) && !isReasonValid;
  const reasonError = showReasonError
    ? trimmedReason.length === 0
      ? "Este campo es obligatorio."
      : `Máximo ${MAX_REASON_LENGTH} caracteres.`
    : undefined;

  async function handleSubmit(): Promise<void> {
    setSubmitAttempted(true);
    if (!isValid) return;
    const input =
      mode === "absolute" ? { onHand: parsedAmount } : { delta: mode === "in" ? parsedAmount : -parsedAmount };
    await onConfirm(input, trimmedReason);
  }

  const title = item ? `Ajustar ${item.product?.name ?? item.sku}` : "Ajustar stock";

  const preview =
    item && isAmountValid
      ? (() => {
          const newOnHand = mode === "absolute" ? parsedAmount : item.onHand + (mode === "in" ? parsedAmount : -parsedAmount);
          const newAvailable = newOnHand - item.reserved;
          return `Quedarán ${newAvailable} disponibles (${newOnHand} en bodega).`;
        })()
      : undefined;

  return (
    <Modal
      open={item !== null}
      onClose={handleClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            Guardar
          </Button>
        </>
      }
    >
      {item ? (
        <div className="flex flex-col gap-md">
          <p className="font-body text-caption text-grafito">
            {item.sku} — actualmente {item.onHand} en bodega, {item.available} disponible.
          </p>

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
              <Button
                type="button"
                variant={mode === "absolute" ? "secondary" : "bare"}
                size="sm"
                onClick={() => setMode("absolute")}
              >
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

          <div className="flex flex-col gap-xs">
            <label htmlFor={reasonId} className="font-ui text-ui text-negro">
              Motivo
            </label>
            <textarea
              id={reasonId}
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setReasonTouched(true)}
              placeholder="p. ej. Recepción de embarque del proveedor"
              aria-invalid={Boolean(reasonError) || undefined}
              className="rounded-control border border-borde bg-surface p-md font-body text-body text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
            />
            {reasonError ? (
              <p className="font-body text-caption text-estado-error">{reasonError}</p>
            ) : (
              <p className="font-body text-caption text-grafito">{trimmedReason.length}/{MAX_REASON_LENGTH} caracteres</p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
