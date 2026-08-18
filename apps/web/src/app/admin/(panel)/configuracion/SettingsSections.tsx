"use client";

import type { AdminSettings, ThreeDSecurePolicy } from "@bw-bikes/shared";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/hooks/use-toast";
import { updateAdminSettingsSection } from "@/lib/api/admin-settings";
import { ApiError } from "@/lib/api/error";
import { centsToPriceInput, parsePriceToCents } from "@/lib/catalog/price";
import { SettingsSectionCard } from "./SettingsSectionCard";

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Every section's onSaved gets the *whole* refreshed document — a PUT always returns it — so a stale sibling section elsewhere on the page can't happen. */
interface SectionProps {
  settings: AdminSettings;
  onSaved: (settings: AdminSettings) => void;
}

/** A field's raw text → an integer, or `null` when it isn't one — every numeric field on this page uses this, never a bare `Number()` that would silently accept `"12abc"` as `12`. */
function parseInt(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  return Number.parseInt(raw, 10);
}

export function InventorySection({ settings, onSaved }: SectionProps) {
  const { toast } = useToast();
  const [ttl, setTtl] = useState(String(settings.inventory.stockReservationTtlMinutes));
  const [retention, setRetention] = useState(String(settings.inventory.reservationRetentionDays));
  const [threshold, setThreshold] = useState(String(settings.inventory.lowStockThresholdUnits));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    const stockReservationTtlMinutes = parseInt(ttl);
    const reservationRetentionDays = parseInt(retention);
    const lowStockThresholdUnits = parseInt(threshold);
    if (stockReservationTtlMinutes === null || reservationRetentionDays === null || lowStockThresholdUnits === null) {
      toast({ variant: "error", title: "Revisa los campos", description: "Todos los valores deben ser enteros." });
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateAdminSettingsSection("inventory", {
        stockReservationTtlMinutes,
        reservationRetentionDays,
        lowStockThresholdUnits,
      });
      onSaved(updated);
      toast({ variant: "success", title: "Inventario actualizado" });
    } catch (error) {
      toast({ variant: "error", title: "No se pudo guardar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSectionCard
      title="Inventario"
      description="Cuánto tiempo un checkout puede apartar stock, y desde cuándo un SKU se muestra como bajo."
      onSubmit={() => void handleSubmit()}
      submitting={submitting}
    >
      <Input
        label="Minutos de reserva por checkout"
        inputMode="numeric"
        value={ttl}
        onChange={(event) => setTtl(event.target.value)}
        wrapperClassName="w-full sm:w-56"
      />
      <Input
        label="Días de retención de reservas"
        inputMode="numeric"
        value={retention}
        onChange={(event) => setRetention(event.target.value)}
        wrapperClassName="w-full sm:w-56"
      />
      <Input
        label="Umbral de stock bajo (unidades)"
        inputMode="numeric"
        value={threshold}
        onChange={(event) => setThreshold(event.target.value)}
        wrapperClassName="w-full sm:w-56"
      />
    </SettingsSectionCard>
  );
}

const THREE_D_SECURE_OPTIONS: { value: ThreeDSecurePolicy; label: string }[] = [
  { value: "automatic", label: "Automático (Stripe decide)" },
  { value: "any", label: "Siempre exigir 3D Secure" },
];

export function OrdersSection({ settings, onSaved }: SectionProps) {
  const { toast } = useToast();
  const [paymentTtl, setPaymentTtl] = useState(String(settings.orders.orderPaymentTtlMinutes));
  const [alertHours, setAlertHours] = useState(String(settings.orders.orderAuthAlertHours));
  const [cancelHours, setCancelHours] = useState(String(settings.orders.orderAuthCancelHours));
  const [reconciliation, setReconciliation] = useState(String(settings.orders.paymentReconciliationAfterMinutes));
  const [threeDSecure, setThreeDSecure] = useState<ThreeDSecurePolicy>(settings.orders.requestThreeDSecure);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    const orderPaymentTtlMinutes = parseInt(paymentTtl);
    const orderAuthAlertHours = parseInt(alertHours);
    const orderAuthCancelHours = parseInt(cancelHours);
    const paymentReconciliationAfterMinutes = parseInt(reconciliation);
    if (
      orderPaymentTtlMinutes === null ||
      orderAuthAlertHours === null ||
      orderAuthCancelHours === null ||
      paymentReconciliationAfterMinutes === null
    ) {
      toast({ variant: "error", title: "Revisa los campos", description: "Todos los valores deben ser enteros." });
      return;
    }
    // Mirrors the model's own invariant — catching it here means the admin
    // sees the problem next to the fields instead of after a round trip.
    if (orderAuthAlertHours >= orderAuthCancelHours) {
      toast({
        variant: "error",
        title: "Revisa las horas de autorización",
        description: "Las horas de aviso deben ser menores a las de cancelación.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateAdminSettingsSection("orders", {
        orderPaymentTtlMinutes,
        orderAuthAlertHours,
        orderAuthCancelHours,
        paymentReconciliationAfterMinutes,
        requestThreeDSecure: threeDSecure,
      });
      onSaved(updated);
      toast({ variant: "success", title: "Órdenes actualizado" });
    } catch (error) {
      toast({ variant: "error", title: "No se pudo guardar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSectionCard
      title="Órdenes"
      description="Los cuatro relojes del ciclo de vida de una orden: pago, aviso y cancelación de autorización, y reconciliación."
      onSubmit={() => void handleSubmit()}
      submitting={submitting}
    >
      <Input
        label="Minutos para pagar"
        inputMode="numeric"
        value={paymentTtl}
        onChange={(event) => setPaymentTtl(event.target.value)}
        wrapperClassName="w-full sm:w-48"
      />
      <Input
        label="Horas de aviso"
        inputMode="numeric"
        value={alertHours}
        onChange={(event) => setAlertHours(event.target.value)}
        wrapperClassName="w-full sm:w-40"
      />
      <Input
        label="Horas de cancelación"
        inputMode="numeric"
        value={cancelHours}
        onChange={(event) => setCancelHours(event.target.value)}
        wrapperClassName="w-full sm:w-40"
      />
      <Input
        label="Minutos de gracia de reconciliación"
        inputMode="numeric"
        value={reconciliation}
        onChange={(event) => setReconciliation(event.target.value)}
        wrapperClassName="w-full sm:w-56"
      />
      <Select
        label="Política 3D Secure"
        value={threeDSecure}
        onChange={(event) => setThreeDSecure(event.target.value as ThreeDSecurePolicy)}
        wrapperClassName="w-full sm:w-60"
      >
        {THREE_D_SECURE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </SettingsSectionCard>
  );
}

export function PricingSection({ settings, onSaved }: SectionProps) {
  const { toast } = useToast();
  const [taxRate, setTaxRate] = useState((settings.pricing.taxRateBps / 100).toString());
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    const percent = Number.parseFloat(taxRate);
    if (!Number.isFinite(percent) || percent < 0) {
      toast({ variant: "error", title: "Revisa la tasa de IVA", description: "Debe ser un porcentaje válido." });
      return;
    }
    const taxRateBps = Math.round(percent * 100);

    setSubmitting(true);
    try {
      const updated = await updateAdminSettingsSection("pricing", { taxRateBps });
      onSaved(updated);
      toast({ variant: "success", title: "Precios actualizado" });
    } catch (error) {
      toast({ variant: "error", title: "No se pudo guardar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSectionCard
      title="Precios"
      description="La tasa de IVA usada solo para desglosar el impuesto de un precio que ya lo incluye — nunca se suma al cobro."
      onSubmit={() => void handleSubmit()}
      submitting={submitting}
    >
      <Input
        label="Tasa de IVA (%)"
        inputMode="decimal"
        value={taxRate}
        onChange={(event) => setTaxRate(event.target.value)}
        wrapperClassName="w-full sm:w-40"
      />
    </SettingsSectionCard>
  );
}

export function ShippingSection({ settings, onSaved }: SectionProps) {
  const { toast } = useToast();
  const [flat, setFlat] = useState(centsToPriceInput(settings.shipping.accessoryFlatCents));
  const [freeThreshold, setFreeThreshold] = useState(centsToPriceInput(settings.shipping.freeShippingThresholdCents));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    const accessoryFlatCents = parsePriceToCents(flat);
    const freeShippingThresholdCents = parsePriceToCents(freeThreshold);
    if (accessoryFlatCents === null || freeShippingThresholdCents === null) {
      toast({ variant: "error", title: "Revisa los montos", description: "Deben ser precios válidos en pesos." });
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateAdminSettingsSection("shipping", { accessoryFlatCents, freeShippingThresholdCents });
      onSaved(updated);
      toast({ variant: "success", title: "Envíos actualizado" });
    } catch (error) {
      toast({ variant: "error", title: "No se pudo guardar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSectionCard
      title="Envíos"
      description="Tarifa plana para accesorios y el subtotal a partir del cual el envío es gratis. Una bici siempre lo alcanza con su propio precio."
      onSubmit={() => void handleSubmit()}
      submitting={submitting}
    >
      <Input
        label="Tarifa de envío de accesorios (MXN)"
        inputMode="decimal"
        value={flat}
        onChange={(event) => setFlat(event.target.value)}
        wrapperClassName="w-full sm:w-56"
      />
      <Input
        label="Umbral de envío gratis (MXN)"
        inputMode="decimal"
        value={freeThreshold}
        onChange={(event) => setFreeThreshold(event.target.value)}
        wrapperClassName="w-full sm:w-56"
      />
    </SettingsSectionCard>
  );
}

export function ApplicationsSection({ settings, onSaved }: SectionProps) {
  const { toast } = useToast();
  const [cooldown, setCooldown] = useState(String(settings.applications.cooldownDays));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    const cooldownDays = parseInt(cooldown);
    if (cooldownDays === null) {
      toast({ variant: "error", title: "Revisa el campo", description: "Debe ser un número entero de días." });
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateAdminSettingsSection("applications", { cooldownDays });
      onSaved(updated);
      toast({ variant: "success", title: "Solicitudes actualizado" });
    } catch (error) {
      toast({ variant: "error", title: "No se pudo guardar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSectionCard
      title="Solicitudes"
      description="Cuánto debe esperar un embajador o patrocinio rechazado antes de volver a aplicar."
      onSubmit={() => void handleSubmit()}
      submitting={submitting}
    >
      <Input
        label="Días de espera para reaplicar"
        inputMode="numeric"
        value={cooldown}
        onChange={(event) => setCooldown(event.target.value)}
        wrapperClassName="w-full sm:w-56"
      />
    </SettingsSectionCard>
  );
}

export function JobsSection({ settings, onSaved }: SectionProps) {
  const { toast } = useToast();
  const [reaper, setReaper] = useState(String(settings.jobs.reservationReaperIntervalMs));
  const [authSweep, setAuthSweep] = useState(String(settings.jobs.orderAuthSweepIntervalMs));
  const [reconciliation, setReconciliation] = useState(String(settings.jobs.paymentReconciliationIntervalMs));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    const reservationReaperIntervalMs = parseInt(reaper);
    const orderAuthSweepIntervalMs = parseInt(authSweep);
    const paymentReconciliationIntervalMs = parseInt(reconciliation);
    if (
      reservationReaperIntervalMs === null ||
      orderAuthSweepIntervalMs === null ||
      paymentReconciliationIntervalMs === null
    ) {
      toast({ variant: "error", title: "Revisa los campos", description: "Todos los valores deben ser enteros, en milisegundos." });
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateAdminSettingsSection("jobs", {
        reservationReaperIntervalMs,
        orderAuthSweepIntervalMs,
        paymentReconciliationIntervalMs,
      });
      onSaved(updated);
      toast({ variant: "success", title: "Tareas programadas actualizado" });
    } catch (error) {
      toast({ variant: "error", title: "No se pudo guardar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSectionCard
      title="Tareas programadas"
      description="Cada cuánto corren los barridos de fondo, en milisegundos — afinar esto no cambia una regla de negocio, solo qué tan seguido el sistema revisa."
      onSubmit={() => void handleSubmit()}
      submitting={submitting}
    >
      <Input
        label="Reaper de reservas (ms)"
        inputMode="numeric"
        value={reaper}
        onChange={(event) => setReaper(event.target.value)}
        wrapperClassName="w-full sm:w-48"
      />
      <Input
        label="Barrido de autorizaciones (ms)"
        inputMode="numeric"
        value={authSweep}
        onChange={(event) => setAuthSweep(event.target.value)}
        wrapperClassName="w-full sm:w-48"
      />
      <Input
        label="Reconciliación de pagos (ms)"
        inputMode="numeric"
        value={reconciliation}
        onChange={(event) => setReconciliation(event.target.value)}
        wrapperClassName="w-full sm:w-48"
      />
    </SettingsSectionCard>
  );
}
