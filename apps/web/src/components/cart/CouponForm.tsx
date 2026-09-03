"use client";

import type { AppliedCoupon } from "@bw-bikes/shared";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAsyncAction } from "@/hooks/use-async-action";
import { ApiError } from "@/lib/api/error";
import { useCart } from "./CartProvider";

export interface CouponFormProps {
  coupon?: AppliedCoupon;
}

/** Input + "Aplicar", or the applied code + "Quitar" — never both at once. */
export function CouponForm({ coupon }: CouponFormProps) {
  const { applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  const apply = useAsyncAction(async () => {
    setError(undefined);
    try {
      await applyCoupon(code);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  });

  const remove = useAsyncAction(async () => {
    await removeCoupon();
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!code.trim()) return;
    apply.run();
  }

  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-sm rounded-card-lg border border-borde bg-surface p-lg">
        <p className="font-ui text-ui text-negro">
          Cupón <span className="uppercase">{coupon.code}</span>
        </p>
        <Button variant="text" tone="neutral" size="sm" loading={remove.pending} onClick={remove.run}>
          Quitar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-sm rounded-card-lg border border-borde bg-surface p-lg">
      <div className="flex items-end gap-sm">
        <Input
          label="¿Tienes un cupón?"
          placeholder="Código de cupón"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={error}
          wrapperClassName="flex-1"
        />
        <Button type="submit" variant="secondary" size="md" loading={apply.pending} disabled={!code.trim()}>
          Aplicar
        </Button>
      </div>
    </form>
  );
}
