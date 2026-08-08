"use client";

import { Button } from "@/components/ui/Button";

export interface BulkStatusBarProps {
  selectedCount: number;
  submitting: boolean;
  onMarkProcessing: () => void;
  onMarkDelivered: () => void;
  onClearSelection: () => void;
}

const MAX_BULK_ORDERS = 50;

/**
 * Only appears with a selection ("Todas" tab). Limited to the two statuses
 * `PATCH /orders/bulk-status` accepts (`BULK_ALLOWED_STATUSES`) — `shipped`
 * needs a tracking number per order and the two money-moving terminals
 * aren't a batch operation, so neither gets a button here.
 */
export function BulkStatusBar({
  selectedCount,
  submitting,
  onMarkProcessing,
  onMarkDelivered,
  onClearSelection,
}: BulkStatusBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-md border-b border-borde bg-base px-lg py-sm">
      <p className="font-ui text-ui text-negro">
        {selectedCount} orden{selectedCount === 1 ? "" : "es"} seleccionada{selectedCount === 1 ? "" : "s"}
        {selectedCount > MAX_BULK_ORDERS ? ` — máximo ${MAX_BULK_ORDERS} por lote` : ""}
      </p>
      <div className="flex gap-sm">
        <Button variant="ghost" onClick={onClearSelection} disabled={submitting}>
          Limpiar selección
        </Button>
        <Button
          variant="secondary"
          onClick={onMarkProcessing}
          disabled={submitting || selectedCount > MAX_BULK_ORDERS}
          loading={submitting}
        >
          Marcar en preparación
        </Button>
        <Button
          variant="primary"
          onClick={onMarkDelivered}
          disabled={submitting || selectedCount > MAX_BULK_ORDERS}
          loading={submitting}
        >
          Marcar entregada
        </Button>
      </div>
    </div>
  );
}
