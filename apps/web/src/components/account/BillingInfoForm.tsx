"use client";

import type { BillingInfo } from "@bw-bikes/shared";
import { CFDI_USES, TAX_REGIMES } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { setAccountBillingInfo } from "@/lib/api/account";
import { ApiError } from "@/lib/api/error";
import { BillingFields, validateBillingInfo, type BillingFormErrors } from "./BillingFields";

export interface BillingInfoFormProps {
  initial?: BillingInfo;
  onClose: () => void;
  onSaved: (billingInfo: BillingInfo) => void;
}

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
  const [errors, setErrors] = useState<BillingFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof BillingInfo>(key: K, value: BillingInfo[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors = validateBillingInfo(form);
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
        <BillingFields form={form} errors={errors} onChange={set} />
        {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}
      </div>
    </Modal>
  );
}
