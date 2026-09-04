"use client";

import type { AdminInventoryVariantRow } from "@bw-bikes/shared";
import { Minus, Plus, Warning, WarningOctagon } from "@phosphor-icons/react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { VariantAdjustForm } from "./VariantAdjustForm";

export interface VariantStockRowProps {
  variant: AdminInventoryVariantRow;
  /** This variant's own mutation in flight — gates only this row's controls, never the whole modal. */
  pending: boolean;
  /** Tracked: `PATCH .../stock` with `{delta:+amount}`. Untracked: `POST /admin/inventory` with `{onHand:amount}` — the caller decides which, based on `variant.inventoryItemId`. */
  onIncrement: (amount: number) => void;
  onDecrement: (amount: number) => void;
  onAdjustSubmit: (input: { delta: number } | { onHand: number }, reason: string | undefined) => void | Promise<void>;
}

/**
 * One variant, three states — the table the redesign's brief spelled out:
 * tracked `in_stock` gets the full stepper + "Ajustar" (for the absolute
 * "Recuento físico" mode a stepper can't express); untracked `in_stock` gets
 * only `+` (creating its first row *is* the fast path, so there is nothing
 * yet to subtract or overwrite); `on_request`/`preorder` gets neither — same
 * rule the old SKU-level `InventoryRow` applied.
 */
export function VariantStockRow({ variant, pending, onIncrement, onDecrement, onAdjustSubmit }: VariantStockRowProps) {
  const [stepAmount, setStepAmount] = useState("1");
  const [adjustOpen, setAdjustOpen] = useState(false);

  const parsedStep = Math.max(1, Number.parseInt(stepAmount, 10) || 1);
  const stockHolding = variant.fulfillmentMode === "in_stock";
  const tracked = variant.inventoryItemId !== null;
  const isOut = stockHolding && tracked && variant.available <= 0;
  const isLow = stockHolding && tracked && !isOut && variant.available <= variant.lowStockThresholdUnits;

  return (
    <div className="flex flex-col gap-sm border-b border-borde px-md py-sm last:border-b-0">
      <div className="flex items-center gap-md">
        <div className="min-w-0 flex-1">
          <p className="font-ui text-ui text-negro">{variant.size ?? "Talla única"}</p>
          <p className="truncate font-body text-caption text-grafito">{variant.sku}</p>
        </div>

        {!stockHolding ? (
          <Badge variant="unavailable">Bajo pedido</Badge>
        ) : tracked ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-display text-h3 text-negro tabular-nums">{variant.available}</span>
            <span className="font-body text-caption text-grafito">
              {variant.onHand} en bodega{variant.reserved > 0 ? ` · ${variant.reserved} apartado` : ""}
            </span>
          </div>
        ) : (
          <span className="shrink-0 font-ui text-caption text-grafito">Sin registro</span>
        )}

        {stockHolding && (isOut || isLow) ? (
          <Badge variant={isOut ? "error" : "advertencia"}>
            <span className="inline-flex items-center gap-1">
              {isOut ? <WarningOctagon size={12} weight="bold" aria-hidden="true" /> : <Warning size={12} weight="bold" aria-hidden="true" />}
              {isOut ? "Agotado" : "Bajo"}
            </span>
          </Badge>
        ) : null}

        {stockHolding ? (
          <div className="flex shrink-0 items-center gap-xs">
            <div
              role="group"
              aria-label={`Ajustar stock de ${variant.sku}`}
              className="inline-flex items-center rounded-control border border-borde bg-surface [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-r-borde"
            >
              <Button
                type="button"
                variant="bare"
                size="icon"
                aria-label="Restar unidades"
                disabled={pending || !tracked}
                title={!tracked ? "No hay stock registrado para restar" : undefined}
                onClick={() => onDecrement(parsedStep)}
              >
                <Minus size={14} weight="bold" aria-hidden="true" />
              </Button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={stepAmount}
                disabled={pending}
                onChange={(event) => setStepAmount(event.target.value)}
                aria-label="Cantidad a ajustar"
                className="h-9 w-10 border-0 bg-transparent text-center font-ui text-ui text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
              />
              <Button
                type="button"
                variant="bare"
                size="icon"
                aria-label="Sumar unidades"
                disabled={pending}
                onClick={() => onIncrement(parsedStep)}
              >
                <Plus size={14} weight="bold" aria-hidden="true" />
              </Button>
            </div>

            {tracked ? (
              <Button variant="bare" size="sm" onClick={() => setAdjustOpen((current) => !current)}>
                Ajustar
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {adjustOpen ? (
        <VariantAdjustForm
          variant={variant}
          submitting={pending}
          onCancel={() => setAdjustOpen(false)}
          onSubmit={async (input, reason) => {
            await onAdjustSubmit(input, reason);
            setAdjustOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
