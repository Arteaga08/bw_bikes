"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// Mirrors rejectSupplierStockSchema (apps/api/src/validators/order.validator.ts):
// Joi.string().trim().min(5).max(300).required().
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 300;

export interface RejectSupplierDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  orderNumber: string;
  submitting: boolean;
}

function reasonError(reason: string): string | undefined {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return undefined; // don't shame an untouched field
  if (trimmed.length < MIN_REASON_LENGTH) return `El motivo debe tener al menos ${MIN_REASON_LENGTH} caracteres.`;
  if (trimmed.length > MAX_REASON_LENGTH) return `El motivo no puede exceder ${MAX_REASON_LENGTH} caracteres.`;
  return undefined;
}

/**
 * Cancels the Stripe authorization with zero charge and releases the
 * reserved units — mirrors `rejectSupplierStockSchema`'s validation
 * client-side so the 400 never round-trips for an obviously-too-short
 * reason, while the backend remains the source of truth for the rule.
 */
export function RejectSupplierDialog({ open, onClose, onConfirm, orderNumber, submitting }: RejectSupplierDialogProps) {
  const [reason, setReason] = useState("");
  const textareaId = useId();
  const error = reasonError(reason);
  const trimmedLength = reason.trim().length;
  const isValid = trimmedLength >= MIN_REASON_LENGTH && trimmedLength <= MAX_REASON_LENGTH;

  function handleClose(): void {
    setReason("");
    onClose();
  }

  async function handleSubmit(): Promise<void> {
    if (!isValid) return;
    await onConfirm(reason.trim());
    setReason("");
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Rechazar ${orderNumber}`}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={handleSubmit} disabled={!isValid} loading={submitting}>
            Rechazar y liberar stock
          </Button>
        </>
      }
    >
      <p className="font-body text-body text-negro">
        El proveedor no tiene existencias. Esto cancela la autorización en Stripe sin cobrar nada y libera las
        unidades reservadas.
      </p>
      <div className="mt-md flex flex-col gap-xs">
        <label htmlFor={textareaId} className="font-ui text-ui text-negro">
          Motivo del rechazo
        </label>
        <textarea
          id={textareaId}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={`${textareaId}-count`}
          className="rounded-control border border-borde bg-surface p-md font-body text-body text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
        />
        <p id={`${textareaId}-count`} className="font-body text-caption text-grafito">
          {error ?? `${trimmedLength}/${MAX_REASON_LENGTH} caracteres`}
        </p>
      </div>
    </Modal>
  );
}
