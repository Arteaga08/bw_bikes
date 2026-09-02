"use client";

import type { BillingInfo, CfdiUse, TaxRegime } from "@bw-bikes/shared";
import { CFDI_USE_LABELS, CFDI_USES, TAX_REGIME_LABELS, TAX_REGIMES } from "@bw-bikes/shared";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface BillingFormErrors {
  rfc?: string;
  legalName?: string;
  postalCode?: string;
}

const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

export function validateBillingInfo(form: BillingInfo): BillingFormErrors {
  const next: BillingFormErrors = {};
  if (!RFC_PATTERN.test(form.rfc.trim().toUpperCase())) next.rfc = "El RFC no tiene un formato válido.";
  if (form.legalName.trim().length < 3) next.legalName = "La razón social es demasiado corta.";
  if (!/^\d{5}$/.test(form.postalCode.trim())) next.postalCode = "El código postal debe tener 5 dígitos.";
  return next;
}

export interface BillingFieldsProps {
  form: BillingInfo;
  errors: BillingFormErrors;
  onChange: <K extends keyof BillingInfo>(key: K, value: BillingInfo[K]) => void;
}

/** The field list shared by `BillingInfoForm` (A3's modal) and the checkout's billing step. */
export function BillingFields({ form, errors, onChange }: BillingFieldsProps) {
  return (
    <div className="flex flex-col gap-md">
      <Input
        label="RFC"
        value={form.rfc}
        onChange={(event) => onChange("rfc", event.target.value)}
        error={errors.rfc}
      />
      <Input
        label="Razón social"
        value={form.legalName}
        onChange={(event) => onChange("legalName", event.target.value)}
        error={errors.legalName}
      />
      <Select label="Uso de CFDI" value={form.cfdiUse} onChange={(event) => onChange("cfdiUse", event.target.value as CfdiUse)}>
        {CFDI_USES.map((use) => (
          <option key={use} value={use}>
            {CFDI_USE_LABELS[use]}
          </option>
        ))}
      </Select>
      <Select
        label="Régimen fiscal"
        value={form.taxRegime}
        onChange={(event) => onChange("taxRegime", event.target.value as TaxRegime)}
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
        onChange={(event) => onChange("postalCode", event.target.value)}
        error={errors.postalCode}
        helper="5 dígitos."
      />
    </div>
  );
}
