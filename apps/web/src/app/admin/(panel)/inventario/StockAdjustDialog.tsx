"use client";

import type { AdminInventoryItem } from "@bw-bikes/shared";
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

/**
 * Delta by default — "entraron 5" / "salieron 2" is how a shipment or a
 * write-off is actually counted, and it's safe under concurrency: if
 * someone else adjusted this row in the meantime, adding 5 is still
 * correct. Absolute (`onHand`) is the second mode, for a physical recount
 * where overwriting is the intent — mirrors `adjustStockSchema`'s
 * `.xor("onHand","delta")`.
 *
 * Motivo is required here even though the backend leaves it optional: it's
 * the only thing that makes the audit trail legible afterward — an
 * adjustment with no reason is a number that changed with no explanation.
 */
export function StockAdjustDialog({ item, onClose, onConfirm, submitting }: StockAdjustDialogProps) {
  const [mode, setMode] = useState<"delta" | "absolute">("delta");
  const [deltaSign, setDeltaSign] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const amountId = useId();
  const reasonId = useId();

  function handleClose(): void {
    setMode("delta");
    setDeltaSign("in");
    setAmount("");
    setReason("");
    onClose();
  }

  const parsedAmount = Number.parseInt(amount, 10);
  const isAmountValid = amount.trim() !== "" && Number.isInteger(parsedAmount) && parsedAmount > 0;
  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length > 0 && trimmedReason.length <= MAX_REASON_LENGTH;
  const isValid = isAmountValid && isReasonValid;

  async function handleSubmit(): Promise<void> {
    if (!isValid) return;
    const input = mode === "delta" ? { delta: deltaSign === "in" ? parsedAmount : -parsedAmount } : { onHand: parsedAmount };
    await onConfirm(input, trimmedReason);
  }

  return (
    <Modal
      open={item !== null}
      onClose={handleClose}
      title={item ? `Ajustar ${item.sku}` : "Ajustar stock"}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} disabled={!isValid} onClick={() => void handleSubmit()}>
            Guardar
          </Button>
        </>
      }
    >
      {item ? (
        <div className="flex flex-col gap-md">
          <p className="font-body text-caption text-grafito">
            Actualmente {item.onHand} en bodega, {item.available} disponible.
          </p>

          <div className="flex flex-col gap-xs">
            <span className="font-ui text-ui text-negro">Tipo de ajuste</span>
            <ButtonGroup label="Tipo de ajuste">
              <Button
                type="button"
                variant={mode === "delta" ? "secondary" : "bare"}
                size="sm"
                onClick={() => setMode("delta")}
              >
                Entrada/salida
              </Button>
              <Button
                type="button"
                variant={mode === "absolute" ? "secondary" : "bare"}
                size="sm"
                onClick={() => setMode("absolute")}
              >
                Recuento físico
              </Button>
            </ButtonGroup>
          </div>

          {mode === "delta" ? (
            <div className="flex flex-col gap-xs">
              <span className="font-ui text-ui text-negro">Movimiento</span>
              <ButtonGroup label="Movimiento">
                <Button
                  type="button"
                  variant={deltaSign === "in" ? "secondary" : "bare"}
                  size="sm"
                  onClick={() => setDeltaSign("in")}
                >
                  Entraron
                </Button>
                <Button
                  type="button"
                  variant={deltaSign === "out" ? "secondary" : "bare"}
                  size="sm"
                  onClick={() => setDeltaSign("out")}
                >
                  Salieron
                </Button>
              </ButtonGroup>
            </div>
          ) : null}

          <Input
            id={amountId}
            label={mode === "delta" ? "Unidades" : "Nuevo stock físico"}
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
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
              placeholder="p. ej. Recepción de embarque del proveedor"
              className="rounded-control border border-borde bg-surface p-md font-body text-body text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
            />
            <p className="font-body text-caption text-grafito">{trimmedReason.length}/{MAX_REASON_LENGTH} caracteres</p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
