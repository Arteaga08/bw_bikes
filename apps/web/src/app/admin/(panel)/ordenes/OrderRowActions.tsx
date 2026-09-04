"use client";

import { Button } from "@/components/ui/Button";
import { TableRowActions } from "@/components/ui/DataTable";

export interface OrderRowActionsProps {
  /** True for whichever order is `awaiting_supplier_confirmation` right now — a property of the row, not of which tab it's viewed from, so it shows up the same way in "Todas". */
  showSupplierActions: boolean;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

/**
 * Confirm/reject only — "Ver detalle" is gone. `DataTable`'s `onRowClick` (a
 * click anywhere on the row) and the folio's own button
 * (`OrderNumberCell`'s keyboard route) already open the same panel, so a
 * third, per-row button to do it again was pure repetition.
 */
export function OrderRowActions({ showSupplierActions, busy, onConfirm, onReject }: OrderRowActionsProps) {
  if (!showSupplierActions) return null;
  return (
    <TableRowActions>
      <Button variant="primary" size="sm" disabled={busy} onClick={onConfirm}>
        Confirmar
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onReject}>
        Rechazar
      </Button>
    </TableRowActions>
  );
}
