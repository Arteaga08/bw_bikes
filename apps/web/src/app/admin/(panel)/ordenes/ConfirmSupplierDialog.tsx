"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrencyCents } from "@/lib/format";

export interface ConfirmSupplierDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  orderNumber: string;
  totalCents: number;
  submitting: boolean;
}

/**
 * The one dialog in this milestone that moves real money (Stripe test mode
 * today, live once the account switches): the text says so in plain
 * language, not just "confirmar", because a misclick here charges a card.
 */
export function ConfirmSupplierDialog({
  open,
  onClose,
  onConfirm,
  orderNumber,
  totalCents,
  submitting,
}: ConfirmSupplierDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Confirmar ${orderNumber}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={submitting}>
            Confirmar y capturar el cargo
          </Button>
        </>
      }
    >
      <p className="font-body text-body text-negro">
        El proveedor confirmó existencias. Esta acción <strong>captura el cargo real</strong> de{" "}
        <strong>{formatCurrencyCents(totalCents)}</strong> en Stripe — no es una simulación.
      </p>
    </Modal>
  );
}
