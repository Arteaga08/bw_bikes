"use client";

import type { SaveAddressInput, SavedAddress } from "@bw-bikes/shared";
import { MEXICAN_STATES } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { createAccountAddress, updateAccountAddress } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";
import { AddressFields, validateAddress, type AddressFormErrors } from "./AddressFields";

export interface AddressFormProps {
  /** Present when editing an existing entry; absent when creating a new one. */
  initial?: SavedAddress;
  onClose: () => void;
  onSaved: (addresses: SavedAddress[]) => void;
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
  const [errors, setErrors] = useState<AddressFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof SaveAddressInput>(key: K, value: SaveAddressInput[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors = validateAddress(form);
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
        <AddressFields form={form} errors={errors} onChange={set} />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      </div>
    </Modal>
  );
}
