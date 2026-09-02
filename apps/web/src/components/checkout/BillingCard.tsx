"use client";

import type { BillingInfo } from "@bw-bikes/shared";
import { CFDI_USES, TAX_REGIMES } from "@bw-bikes/shared";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { BillingFields, validateBillingInfo, type BillingFormErrors } from "@/components/account/BillingFields";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ApiError } from "@/lib/api/error";

export interface BillingCardProps {
  /** The account's own saved CFDI data (A3), used only to pre-fill the form the first time the checkbox is checked. */
  initialBillingInfo?: BillingInfo;
}

const emptyForm = (prefill?: BillingInfo): BillingInfo =>
  prefill ?? { rfc: "", legalName: "", cfdiUse: CFDI_USES[0], taxRegime: TAX_REGIMES[0], postalCode: "" };

/**
 * The Facturación card (C1-checkout-datos.md §4) — a single checkbox that
 * gates the CFDI fields. Nothing here touches the account's own billing
 * info; every write is `PUT`/`DELETE /cart/billing-info` via `useCart()`,
 * scoped to this cart the same way the shipping address is.
 */
export function BillingCard({ initialBillingInfo }: BillingCardProps) {
  const { cart, setBillingInfo, removeBillingInfo } = useCart();
  const savedOnCart = cart?.billingInfo;

  const [checked, setChecked] = useState(Boolean(savedOnCart));
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BillingInfo>(() => emptyForm(savedOnCart ?? initialBillingInfo));
  const [errors, setErrors] = useState<BillingFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function set<K extends keyof BillingInfo>(key: K, value: BillingInfo[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleToggle(next: boolean): Promise<void> {
    setChecked(next);
    setSubmitError(null);

    if (next) {
      setForm(emptyForm(savedOnCart ?? initialBillingInfo));
      setEditing(!savedOnCart);
      return;
    }

    setEditing(false);
    if (savedOnCart) {
      try {
        await removeBillingInfo();
      } catch (err) {
        // Roll back to the saved state — the DELETE failed, so the cart
        // still has billingInfo, and the checkbox must not claim otherwise.
        setChecked(true);
        setEditing(false);
        setSubmitError(err instanceof ApiError ? err.message : "No se pudieron eliminar los datos fiscales.");
      }
    }
  }

  async function handleSave(): Promise<void> {
    const nextErrors = validateBillingInfo(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      await setBillingInfo({
        ...form,
        rfc: form.rfc.trim().toUpperCase(),
        legalName: form.legalName.trim(),
        postalCode: form.postalCode.trim(),
      });
      setEditing(false);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudieron guardar los datos fiscales.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-xl">
      <h2 className="font-display text-h4 text-negro">Facturación</h2>
      <Checkbox
        label="Necesito factura (CFDI)"
        checked={checked}
        onChange={(event) => void handleToggle(event.target.checked)}
      />

      {submitError ? <p className="font-body text-caption text-estado-error">{submitError}</p> : null}

      {checked && editing ? (
        <>
          <BillingFields form={form} errors={errors} onChange={set} />
          <Button variant="primary" size="md" loading={submitting} onClick={() => void handleSave()}>
            Guardar datos fiscales
          </Button>
        </>
      ) : null}

      {checked && !editing && savedOnCart ? (
        <div className="flex items-start justify-between gap-sm">
          <div>
            <p className="font-ui text-ui text-negro">{savedOnCart.legalName}</p>
            <p className="font-body text-caption text-grafito">RFC {savedOnCart.rfc}</p>
          </div>
          <Button variant="text" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        </div>
      ) : null}
    </section>
  );
}
