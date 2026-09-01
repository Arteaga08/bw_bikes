"use client";

import type { BillingInfo, CfdiUse, TaxRegime } from "@bw-bikes/shared";
import { CFDI_USE_LABELS, CFDI_USES, TAX_REGIME_LABELS, TAX_REGIMES } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { setAccountBillingInfo } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";

export interface BillingInfoFormProps {
  initial?: BillingInfo;
  onClose: () => void;
  onSaved: (billingInfo: BillingInfo) => void;
}

interface FormErrors {
  rfc?: string;
  legalName?: string;
  postalCode?: string;
}

const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

const EMPTY_FORM: BillingInfo = {
  rfc: "",
  legalName: "",
  cfdiUse: CFDI_USES[0],
  taxRegime: TAX_REGIMES[0],
  postalCode: "",
};

export function BillingInfoForm({ initial, onClose, onSaved }: BillingInfoFormProps) {
  const [form, setForm] = useState<BillingInfo>(initial ?? EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof BillingInfo>(key: K, value: BillingInfo[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!RFC_PATTERN.test(form.rfc.trim().toUpperCase())) next.rfc = "El RFC no tiene un formato válido.";
    if (form.legalName.trim().length < 3) next.legalName = "La razón social es demasiado corta.";
    if (!/^\d{5}$/.test(form.postalCode.trim())) next.postalCode = "El código postal debe tener 5 dígitos.";
    return next;
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      const billingInfo = await setAccountBillingInfo({
        ...form,
        rfc: form.rfc.trim().toUpperCase(),
        legalName: form.legalName.trim(),
        postalCode: form.postalCode.trim(),
      });
      onSaved(billingInfo);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudieron guardar los datos fiscales.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Datos de facturación"
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
          label="RFC"
          value={form.rfc}
          onChange={(event) => set("rfc", event.target.value)}
          error={errors.rfc}
        />
        <Input
          label="Razón social"
          value={form.legalName}
          onChange={(event) => set("legalName", event.target.value)}
          error={errors.legalName}
        />
        <Select label="Uso de CFDI" value={form.cfdiUse} onChange={(event) => set("cfdiUse", event.target.value as CfdiUse)}>
          {CFDI_USES.map((use) => (
            <option key={use} value={use}>
              {CFDI_USE_LABELS[use]}
            </option>
          ))}
        </Select>
        <Select
          label="Régimen fiscal"
          value={form.taxRegime}
          onChange={(event) => set("taxRegime", event.target.value as TaxRegime)}
        >
          {TAX_REGIMES.map((regime) => (
            <option key={regime} value={regime}>
              {TAX_REGIME_LABELS[regime]}
            </option>
          ))}
        </Select>
        <Input
          label="Código postal fiscal"
          value={form.postalCode}
          onChange={(event) => set("postalCode", event.target.value)}
          error={errors.postalCode}
          helper="5 dígitos."
        />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      </div>
    </Modal>
  );
}
