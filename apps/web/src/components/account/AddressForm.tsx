"use client";

import type { MexicanState, SaveAddressInput, SavedAddress } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { createAccountAddress, updateAccountAddress } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";

export interface AddressFormProps {
  /** Present when editing an existing entry; absent when creating a new one. */
  initial?: SavedAddress;
  onClose: () => void;
  onSaved: (addresses: SavedAddress[]) => void;
}

interface FormErrors {
  label?: string;
  recipientName?: string;
  phone?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
}

const EMPTY_FORM: SaveAddressInput = {
  label: "",
  recipientName: "",
  phone: "",
  street: "",
  interiorNumber: "",
  neighborhood: "",
  city: "",
  state: MEXICAN_STATES[0],
  postalCode: "",
  country: "MX",
  references: "",
};

/** Modal reused for both creating and editing an address book entry. */
export function AddressForm({ initial, onClose, onSaved }: AddressFormProps) {
  const [form, setForm] = useState<SaveAddressInput>(initial ?? EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof SaveAddressInput>(key: K, value: SaveAddressInput[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!form.label.trim()) next.label = "El nombre de la dirección es obligatorio.";
    if (form.recipientName.trim().length < 3) next.recipientName = "El nombre de quien recibe es demasiado corto.";
    if (!/^\d{10}$/.test(form.phone.trim())) next.phone = "El teléfono debe tener 10 dígitos.";
    if (form.street.trim().length < 3) next.street = "La calle es obligatoria.";
    if (form.neighborhood.trim().length < 2) next.neighborhood = "La colonia es obligatoria.";
    if (form.city.trim().length < 2) next.city = "La ciudad es obligatoria.";
    if (!/^\d{5}$/.test(form.postalCode.trim())) next.postalCode = "El código postal debe tener 5 dígitos.";
    return next;
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: SaveAddressInput = {
      ...form,
      label: form.label.trim(),
      recipientName: form.recipientName.trim(),
      phone: form.phone.trim(),
      street: form.street.trim(),
      interiorNumber: form.interiorNumber?.trim() || undefined,
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      postalCode: form.postalCode.trim(),
      references: form.references?.trim() || undefined,
    };

    setSubmitError(null);
    setSubmitting(true);
    try {
      const addresses = initial ? await updateAccountAddress(initial.id, payload) : await createAccountAddress(payload);
      onSaved(addresses);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo guardar la dirección.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Editar dirección" : "Añadir dirección"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <Input
          label="Nombre de la dirección"
          placeholder="Casa, Oficina…"
          value={form.label}
          onChange={(event) => set("label", event.target.value)}
          error={errors.label}
        />
        <Input
          label="Nombre de quien recibe"
          value={form.recipientName}
          onChange={(event) => set("recipientName", event.target.value)}
          error={errors.recipientName}
        />
        <Input
          label="Teléfono"
          type="tel"
          value={form.phone}
          onChange={(event) => set("phone", event.target.value)}
          error={errors.phone}
          helper="10 dígitos."
        />
        <Input
          label="Calle"
          value={form.street}
          onChange={(event) => set("street", event.target.value)}
          error={errors.street}
        />
        <Input
          label="Número interior (opcional)"
          value={form.interiorNumber ?? ""}
          onChange={(event) => set("interiorNumber", event.target.value)}
        />
        <Input
          label="Colonia"
          value={form.neighborhood}
          onChange={(event) => set("neighborhood", event.target.value)}
          error={errors.neighborhood}
        />
        <div className="grid gap-md sm:grid-cols-2">
          <Input
            label="Ciudad"
            value={form.city}
            onChange={(event) => set("city", event.target.value)}
            error={errors.city}
          />
          <Select
            label="Estado"
            value={form.state}
            onChange={(event) => set("state", event.target.value as MexicanState)}
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
          onChange={(event) => set("postalCode", event.target.value)}
          error={errors.postalCode}
          helper="5 dígitos."
        />
        <Input
          label="Referencias (opcional)"
          value={form.references ?? ""}
          onChange={(event) => set("references", event.target.value)}
        />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      </div>
    </Modal>
  );
}
