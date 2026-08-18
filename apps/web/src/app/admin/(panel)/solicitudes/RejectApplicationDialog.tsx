"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// Mirrors rejectApplicationSchema (apps/api/src/validators/application.validator.ts):
// Joi.string().trim().min(5).max(300).required().
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 300;

export interface RejectApplicationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  submitting: boolean;
}

function reasonError(reason: string): string | undefined {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return undefined; // don't shame an untouched field
  if (trimmed.length < MIN_REASON_LENGTH) return `El motivo debe tener al menos ${MIN_REASON_LENGTH} caracteres.`;
  if (trimmed.length > MAX_REASON_LENGTH) return `El motivo no puede exceder ${MAX_REASON_LENGTH} caracteres.`;
  return undefined;
}

/** Mirrors `rejectApplicationSchema` client-side, same discipline as `RejectSupplierDialog` (M9) — the backend stays the source of truth for the rule. */
export function RejectApplicationDialog({ open, onClose, onConfirm, submitting }: RejectApplicationDialogProps) {
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
      title="Rechazar solicitud"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => void handleSubmit()} disabled={!isValid} loading={submitting}>
            Sí, rechazar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-xs">
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
