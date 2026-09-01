"use client";

import type { AccountDTO } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/error";
import { updateAccountProfile } from "@/lib/api/account";

export interface ProfileFormProps {
  initial: AccountDTO;
  onClose: () => void;
  onSaved: (account: AccountDTO) => void;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/** `1990-05-10T00:00:00.000Z` → `1990-05-10`, what a native `type="date"` input wants. */
function toDateInputValue(iso: string | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

export function ProfileForm({ initial, onClose, onSaved }: ProfileFormProps) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [birthDate, setBirthDate] = useState(toDateInputValue(initial.birthDate));
  const [city, setCity] = useState(initial.city ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!firstName.trim()) next.firstName = "El nombre es obligatorio.";
    if (!lastName.trim()) next.lastName = "El apellido es obligatorio.";
    if (phone.trim() && !/^\d{10}$/.test(phone.trim())) next.phone = "El teléfono debe tener 10 dígitos.";
    return next;
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      const account = await updateAccountProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        birthDate: birthDate || undefined,
        city: city.trim() || undefined,
      });
      onSaved(account);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo actualizar el perfil.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar tu información"
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
        <div className="grid gap-md sm:grid-cols-2">
          <Input
            label="Nombre"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            error={errors.firstName}
          />
          <Input
            label="Apellido"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            error={errors.lastName}
          />
        </div>
        <div className="grid gap-md sm:grid-cols-2">
          <Input
            label="Teléfono"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={errors.phone}
            helper="10 dígitos, opcional."
          />
          <Input
            label="Cumpleaños"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>
        <Input label="Ciudad" value={city} onChange={(event) => setCity(event.target.value)} />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      </div>
    </Modal>
  );
}
