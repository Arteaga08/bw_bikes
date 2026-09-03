"use client";

import type { AccountDTO } from "@bw-bikes/shared";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateAccountProfile } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";

export interface ContactCardProps {
  account: AccountDTO;
  onAccountChange: (account: AccountDTO) => void;
  /** Whether this card is the one open in the checkout accordion — see `ShippingStepView`. */
  open: boolean;
  /** Re-opens this card as the active step (the "Editar" affordance in its collapsed summary). */
  onEdit: () => void;
  /** Contact info was saved — advances the accordion to Envío. */
  onDone: () => void;
}

interface ContactForm {
  firstName: string;
  lastName: string;
  phone: string;
}

interface ContactFormErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

const PHONE_PATTERN = /^\d{10}$/;

function validate(form: ContactForm): ContactFormErrors {
  const next: ContactFormErrors = {};
  if (!form.firstName.trim()) next.firstName = "Escribe tu nombre.";
  if (!form.lastName.trim()) next.lastName = "Escribe tu apellido.";
  if (!PHONE_PATTERN.test(form.phone.trim())) next.phone = "El teléfono debe tener 10 dígitos.";
  return next;
}

/**
 * The Contacto card — first accordion of the checkout (M13-checkout-redesign).
 * Unlike `ShippingAddressCard`/`BillingCard`, this writes straight to the
 * account profile via `updateAccountProfile` (same call `ProfileForm` uses in
 * Mi Cuenta) rather than to the cart — contact info is who the buyer *is*,
 * not a per-order snapshot, so there's no separate cart-level concept to
 * introduce here. Which of its two layouts renders is now controlled by the
 * `open` prop from `ShippingStepView` (single accordion owner), not derived
 * locally — see that component for why only one step is ever open.
 */
export function ContactCard({ account, onAccountChange, open, onEdit, onDone }: ContactCardProps) {
  const [form, setForm] = useState<ContactForm>({
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone ?? "",
  });
  const [touched, setTouched] = useState<Partial<Record<keyof ContactForm, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validate(form);
  const isValid = Object.keys(errors).length === 0;

  function set<K extends keyof ContactForm>(key: K, value: ContactForm[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function markTouched(key: keyof ContactForm): void {
    setTouched((current) => ({ ...current, [key]: true }));
  }

  async function handleContinue(): Promise<void> {
    setTouched({ firstName: true, lastName: true, phone: true });
    if (!isValid) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      const updated = await updateAccountProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
      });
      onAccountChange(updated);
      onDone();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo guardar tu información de contacto.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
        <div className="flex items-start justify-between gap-sm">
          <div className="flex items-center gap-xs">
            <Image src="/brand/rhino-dorado.svg" alt="" width={24} height={24} className="shrink-0" />
            <h2 className="font-display text-h2 text-negro">Contacto</h2>
          </div>
          <Button variant="text" size="sm" onClick={onEdit}>
            Editar
          </Button>
        </div>
        <div className="font-body text-body text-negro">
          <p className="font-ui text-ui text-negro">
            {account.firstName} {account.lastName}
          </p>
          <p className="text-grafito">{account.email}</p>
          <p className="text-grafito">{account.phone}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
      <div className="flex items-center gap-xs">
        <Image src="/brand/rhino-dorado.svg" alt="" width={24} height={24} className="shrink-0" />
        <h2 className="font-display text-h2 text-negro">Contacto</h2>
      </div>
      <div className="grid gap-md sm:grid-cols-2">
        <Input
          label="Nombre"
          value={form.firstName}
          onChange={(event) => set("firstName", event.target.value)}
          onBlur={() => markTouched("firstName")}
          error={touched.firstName ? errors.firstName : undefined}
        />
        <Input
          label="Apellido"
          value={form.lastName}
          onChange={(event) => set("lastName", event.target.value)}
          onBlur={() => markTouched("lastName")}
          error={touched.lastName ? errors.lastName : undefined}
        />
      </div>
      <Input label="Correo electrónico" value={account.email} disabled />
      <Input
        label="Teléfono"
        type="tel"
        value={form.phone}
        onChange={(event) => set("phone", event.target.value)}
        onBlur={() => markTouched("phone")}
        error={touched.phone ? errors.phone : undefined}
        helper="Lo usamos solo para avisos de tu entrega."
      />
      {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      <Button variant="primary" size="md" loading={submitting} disabled={!isValid} onClick={() => void handleContinue()}>
        Continuar a envío
      </Button>
    </section>
  );
}
