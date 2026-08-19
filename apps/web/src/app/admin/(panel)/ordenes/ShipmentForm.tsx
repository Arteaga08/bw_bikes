"use client";

import type { Carrier } from "@bw-bikes/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { RecordShipmentInput } from "@/lib/api/admin-orders";

// Mirrors recordShipmentSchema's CARRIERS (apps/api/src/validators/shipping.validator.ts).
const CARRIER_OPTIONS: Array<{ value: Carrier; label: string }> = [
  { value: "dhl", label: "DHL" },
  { value: "fedex", label: "FedEx" },
  { value: "estafeta", label: "Estafeta" },
  { value: "paquetexpress", label: "Paquetexpress" },
  { value: "redpack", label: "Redpack" },
  { value: "ups", label: "UPS" },
  { value: "otro", label: "Otra paquetería" },
];

export interface ShipmentFormProps {
  onSubmit: (input: RecordShipmentInput) => void | Promise<void>;
  submitting: boolean;
  /** Brief post-submit confirmation window, owned by the parent (`OrderDetailModal`) — see `Button`'s `success` prop. */
  success: boolean;
  /** `order.status === "processing"` — this submission also transitions the order to `shipped`. */
  willTransitionToShipped: boolean;
  initial?: RecordShipmentInput;
}

/**
 * `carrierName`/`trackingUrl` are required only when `carrier === "otro"` —
 * the same conditional `recordShipmentSchema` enforces, so the backend never
 * rejects a submission this form accepted. For the six known carriers the
 * backend builds the tracking URL itself (`shippingService.buildTrackingUrl`).
 */
export function ShipmentForm({ onSubmit, submitting, success, willTransitionToShipped, initial }: ShipmentFormProps) {
  const [carrier, setCarrier] = useState<Carrier>(initial?.carrier ?? "dhl");
  const [trackingNumber, setTrackingNumber] = useState(initial?.trackingNumber ?? "");
  const [carrierName, setCarrierName] = useState(initial?.carrierName ?? "");
  const [trackingUrl, setTrackingUrl] = useState(initial?.trackingUrl ?? "");

  const isOtro = carrier === "otro";
  const isValid =
    trackingNumber.trim().length >= 3 && (!isOtro || (carrierName.trim().length > 0 && trackingUrl.trim().length > 0));

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!isValid) return;
    void onSubmit({
      carrier,
      trackingNumber: trackingNumber.trim(),
      ...(isOtro ? { carrierName: carrierName.trim(), trackingUrl: trackingUrl.trim() } : {}),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <label htmlFor="shipment-carrier" className="font-ui text-ui text-negro">
          Paquetería
        </label>
        <select
          id="shipment-carrier"
          value={carrier}
          onChange={(event) => setCarrier(event.target.value as Carrier)}
          className="h-11 rounded-control border border-borde bg-surface px-md font-body text-body text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
        >
          {CARRIER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Número de guía"
        value={trackingNumber}
        onChange={(event) => setTrackingNumber(event.target.value)}
        minLength={3}
        maxLength={60}
        required
      />

      {isOtro ? (
        <>
          <Input
            label="Nombre de la paquetería"
            value={carrierName}
            onChange={(event) => setCarrierName(event.target.value)}
            maxLength={80}
            required
          />
          <Input
            label="URL de rastreo"
            type="url"
            value={trackingUrl}
            onChange={(event) => setTrackingUrl(event.target.value)}
            placeholder="https://…"
            required
            helper="Debe ser https."
          />
        </>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        disabled={!isValid}
        loading={submitting}
        success={success}
        successLabel="Guía guardada"
      >
        {willTransitionToShipped ? "Capturar guía y marcar como enviada" : "Actualizar guía"}
      </Button>
    </form>
  );
}
