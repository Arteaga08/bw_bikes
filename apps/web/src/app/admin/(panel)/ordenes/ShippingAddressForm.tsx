"use client";

import { MEXICAN_STATES, type MexicanState, type ShippingAddress } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface ShippingAddressFormProps {
  initial: ShippingAddress;
  onSubmit: (address: ShippingAddress) => void | Promise<void>;
  submitting: boolean;
  onCancel: () => void;
}

const PHONE_PATTERN = /^\d{10}$/;
const POSTAL_CODE_PATTERN = /^\d{5}$/;

/** Mirrors `shippingAddressSchema` (`apps/api/src/validators/shipping.validator.ts`) field for field. */
export function ShippingAddressForm({ initial, onSubmit, submitting, onCancel }: ShippingAddressFormProps) {
  const [form, setForm] = useState<ShippingAddress>(initial);

  const isValid =
    form.recipientName.trim().length >= 3 &&
    PHONE_PATTERN.test(form.phone) &&
    form.street.trim().length >= 3 &&
    form.neighborhood.trim().length >= 2 &&
    form.city.trim().length >= 2 &&
    POSTAL_CODE_PATTERN.test(form.postalCode);

  function set<K extends keyof ShippingAddress>(key: K, value: ShippingAddress[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(): void {
    if (!isValid) return;
    void onSubmit(form);
  }

  return (
    <div className="flex flex-col gap-md">
      <Input
        label="Nombre del destinatario"
        value={form.recipientName}
        onChange={(event) => set("recipientName", event.target.value)}
        minLength={3}
        maxLength={120}
        required
      />
      <Input
        label="Teléfono (10 dígitos)"
        value={form.phone}
        onChange={(event) => set("phone", event.target.value)}
        error={form.phone && !PHONE_PATTERN.test(form.phone) ? "Debe tener exactamente 10 dígitos." : undefined}
        required
      />
      <Input
        label="Calle"
        value={form.street}
        onChange={(event) => set("street", event.target.value)}
        minLength={3}
        maxLength={150}
        required
      />
      <Input
        label="Número interior (opcional)"
        value={form.interiorNumber ?? ""}
        onChange={(event) => set("interiorNumber", event.target.value)}
        maxLength={30}
      />
      <Input
        label="Colonia"
        value={form.neighborhood}
        onChange={(event) => set("neighborhood", event.target.value)}
        minLength={2}
        maxLength={150}
        required
      />
      <Input
        label="Ciudad"
        value={form.city}
        onChange={(event) => set("city", event.target.value)}
        minLength={2}
        maxLength={150}
        required
      />

      <div className="flex flex-col gap-xs">
        <label htmlFor="shipping-state" className="font-ui text-ui text-negro">
          Estado
        </label>
        <select
          id="shipping-state"
          value={form.state}
          onChange={(event) => set("state", event.target.value as MexicanState)}
          className="h-11 rounded-control border border-borde bg-surface px-md font-body text-body text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
        >
          {MEXICAN_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Código postal (5 dígitos)"
        value={form.postalCode}
        onChange={(event) => set("postalCode", event.target.value)}
        error={
          form.postalCode && !POSTAL_CODE_PATTERN.test(form.postalCode) ? "Debe tener exactamente 5 dígitos." : undefined
        }
        required
      />
      <Input
        label="Referencias (opcional)"
        value={form.references ?? ""}
        onChange={(event) => set("references", event.target.value)}
        maxLength={300}
      />

      <div className="flex justify-end gap-sm">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!isValid} loading={submitting}>
          Guardar dirección
        </Button>
      </div>
    </div>
  );
}
