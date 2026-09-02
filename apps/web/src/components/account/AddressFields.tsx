"use client";

import type { MexicanState, SaveAddressInput } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface AddressFormErrors {
  label?: string;
  recipientName?: string;
  phone?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
}

/** Validates exactly the fields this component renders. `requireLabel: false` skips the label check — the checkout derives it from `street` instead of asking for it (C1-checkout-datos.md §3). */
export function validateAddress(
  form: SaveAddressInput,
  options: { requireLabel?: boolean } = {},
): AddressFormErrors {
  const { requireLabel = true } = options;
  const next: AddressFormErrors = {};
  if (requireLabel && !form.label.trim()) next.label = "El nombre de la dirección es obligatorio.";
  if (form.recipientName.trim().length < 3) next.recipientName = "El nombre de quien recibe es demasiado corto.";
  if (!/^\d{10}$/.test(form.phone.trim())) next.phone = "El teléfono debe tener 10 dígitos.";
  if (form.street.trim().length < 3) next.street = "La calle es obligatoria.";
  if (form.neighborhood.trim().length < 2) next.neighborhood = "La colonia es obligatoria.";
  if (form.city.trim().length < 2) next.city = "La ciudad es obligatoria.";
  if (!/^\d{5}$/.test(form.postalCode.trim())) next.postalCode = "El código postal debe tener 5 dígitos.";
  return next;
}

export interface AddressFieldsProps {
  form: SaveAddressInput;
  errors: AddressFormErrors;
  onChange: <K extends keyof SaveAddressInput>(key: K, value: SaveAddressInput[K]) => void;
  /** Hidden in the checkout — see `validateAddress`'s `requireLabel`. Defaults to shown, for the account address book (A3). */
  showLabelField?: boolean;
}

/** The field list shared by `AddressForm` (A3's modal) and the checkout's shipping step — presentation and validation only, no `Modal`, no `fetch`. */
export function AddressFields({ form, errors, onChange, showLabelField = true }: AddressFieldsProps) {
  return (
    <div className="flex flex-col gap-md">
      {showLabelField ? (
        <Input
          label="Nombre de la dirección"
          placeholder="Casa, Oficina…"
          value={form.label}
          onChange={(event) => onChange("label", event.target.value)}
          error={errors.label}
        />
      ) : null}
      <Input
        label="Nombre de quien recibe"
        value={form.recipientName}
        onChange={(event) => onChange("recipientName", event.target.value)}
        error={errors.recipientName}
      />
      <Input
        label="Teléfono"
        type="tel"
        value={form.phone}
        onChange={(event) => onChange("phone", event.target.value)}
        error={errors.phone}
        helper="10 dígitos."
      />
      <Input
        label="Calle"
        value={form.street}
        onChange={(event) => onChange("street", event.target.value)}
        error={errors.street}
      />
      <Input
        label="Número interior (opcional)"
        value={form.interiorNumber ?? ""}
        onChange={(event) => onChange("interiorNumber", event.target.value)}
      />
      <Input
        label="Colonia"
        value={form.neighborhood}
        onChange={(event) => onChange("neighborhood", event.target.value)}
        error={errors.neighborhood}
      />
      <div className="grid gap-md sm:grid-cols-2">
        <Input
          label="Ciudad"
          value={form.city}
          onChange={(event) => onChange("city", event.target.value)}
          error={errors.city}
        />
        <Select
          label="Estado"
          value={form.state}
          onChange={(event) => onChange("state", event.target.value as MexicanState)}
        >
          {MEXICAN_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="Código postal"
        value={form.postalCode}
        onChange={(event) => onChange("postalCode", event.target.value)}
        error={errors.postalCode}
        helper="5 dígitos."
      />
      <Input
        label="Referencias (opcional)"
        value={form.references ?? ""}
        onChange={(event) => onChange("references", event.target.value)}
      />
    </div>
  );
}
