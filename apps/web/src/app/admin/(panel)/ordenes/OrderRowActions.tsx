"use client";

import { Button } from "@/components/ui/Button";
import { TableRowActions } from "@/components/ui/DataTable";

export interface OrderRowActionsProps {
  /** Only the queue tab (fixed to `awaiting_supplier_confirmation`) offers confirm/reject. */
  showSupplierActions: boolean;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onViewDetail: () => void;
}

export function OrderRowActions({ showSupplierActions, busy, onConfirm, onReject, onViewDetail }: OrderRowActionsProps) {
  return (
    <TableRowActions>
      {showSupplierActions ? (
        <>
          <Button variant="primary" size="sm" disabled={busy} onClick={onConfirm}>
            Confirmar
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onReject}>
            Rechazar
          </Button>
        </>
      ) : null}
      <Button variant="text" disabled={busy} onClick={onViewDetail}>
        Ver detalle
      </Button>
    </TableRowActions>
  );
}
