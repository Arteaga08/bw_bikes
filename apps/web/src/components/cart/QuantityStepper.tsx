"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";

export interface QuantityStepperProps {
  qty: number;
  max: number;
  disabled?: boolean;
  onChange: (qty: number) => void;
}

/**
 * `−`/`+` around the current qty. `+` stops at `max` with a title that names
 * the limit without a number (`B-carrito.md` §6) — the real ceiling
 * (`cart-limits.ts`'s `maxQtyFor`) already hides whatever count produced it.
 * `−` stops at 1: dropping to 0 isn't a valid `PATCH` per the cart's own
 * contract, removing the line has its own button.
 */
export function QuantityStepper({ qty, max, disabled = false, onChange }: QuantityStepperProps) {
  const atMax = qty >= max;
  const atMin = qty <= 1;

  return (
    <ButtonGroup label="Cantidad">
      <Button
        type="button"
        variant="bare"
        size="icon"
        disabled={disabled || atMin}
        onClick={() => onChange(qty - 1)}
        aria-label="Disminuir cantidad"
      >
        <Minus />
      </Button>
      <span className="flex h-9 min-w-9 items-center justify-center px-xs font-ui text-ui text-negro" aria-live="polite">
        {qty}
      </span>
      <Button
        type="button"
        variant="bare"
        size="icon"
        disabled={disabled || atMax}
        title={atMax ? "No hay más unidades disponibles" : undefined}
        onClick={() => onChange(qty + 1)}
        aria-label="Aumentar cantidad"
      >
        <Plus />
      </Button>
    </ButtonGroup>
  );
}
