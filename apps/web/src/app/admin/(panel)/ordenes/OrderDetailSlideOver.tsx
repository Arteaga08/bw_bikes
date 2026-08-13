"use client";

import type { AdminOrder, ShippingAddress } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { FormSkeleton } from "@/components/ui/Skeleton";
import type { RecordShipmentInput } from "@/lib/api/admin-orders";
import { formatCurrencyCents } from "@/lib/format";
import { formatDateTime } from "@/lib/orders/format";
import { AuthorizationCountdown } from "./AuthorizationCountdown";
import { OrderLineList } from "./OrderLineList";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderStatusHistoryList } from "./OrderStatusHistoryList";
import { ShipmentForm } from "./ShipmentForm";
import { ShippingAddressForm } from "./ShippingAddressForm";

// Mirrors updateShippingAddress's own guard in order.service.ts.
const ADDRESS_LOCKED_STATUSES = new Set(["shipped", "delivered", "cancelled", "refunded", "authorization_expired"]);
// recordShipment only accepts these three (order.service.ts's recordShipment).
const SHIPMENT_ELIGIBLE_STATUSES = new Set(["processing", "shipped", "delivered"]);

export interface OrderDetailSlideOverProps {
  order: AdminOrder | null;
  loading: boolean;
  onClose: () => void;
  alertHours: number;
  cancelHours: number;
  onRequestConfirm: () => void;
  onRequestReject: () => void;
  onMarkProcessing: () => Promise<boolean>;
  onMarkDelivered: () => Promise<boolean>;
  onRecordShipment: (input: RecordShipmentInput) => Promise<boolean>;
  onUpdateShippingAddress: (address: ShippingAddress) => Promise<boolean>;
}

/**
 * Lazy-loaded (`next/dynamic`, see `OrdersView.tsx`) — only pulled into the
 * bundle the first time an order is opened. Confirm/reject stay dialogs
 * owned by `OrdersView` (the queue row and this footer must trigger the
 * *same* dialog instance); shipment and address are inline forms this
 * component owns locally, since editing either never needs to leave the
 * panel.
 */
export function OrderDetailSlideOver({
  order,
  loading,
  onClose,
  alertHours,
  cancelHours,
  onRequestConfirm,
  onRequestReject,
  onMarkProcessing,
  onMarkDelivered,
  onRecordShipment,
  onUpdateShippingAddress,
}: OrderDetailSlideOverProps) {
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingShipment, setEditingShipment] = useState(false);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [shipmentSubmitting, setShipmentSubmitting] = useState(false);
  const [statusActionSubmitting, setStatusActionSubmitting] = useState(false);

  const open = order !== null || loading;

  async function handleAddressSubmit(address: ShippingAddress): Promise<void> {
    setAddressSubmitting(true);
    const ok = await onUpdateShippingAddress(address);
    setAddressSubmitting(false);
    if (ok) setEditingAddress(false);
  }

  async function handleShipmentSubmit(input: RecordShipmentInput): Promise<void> {
    setShipmentSubmitting(true);
    const ok = await onRecordShipment(input);
    setShipmentSubmitting(false);
    if (ok) setEditingShipment(false);
  }

  async function handleMarkProcessing(): Promise<void> {
    setStatusActionSubmitting(true);
    await onMarkProcessing();
    setStatusActionSubmitting(false);
  }

  async function handleMarkDelivered(): Promise<void> {
    setStatusActionSubmitting(true);
    await onMarkDelivered();
    setStatusActionSubmitting(false);
  }

  function handleClose(): void {
    setEditingAddress(false);
    setEditingShipment(false);
    onClose();
  }

  const footer = order ? (
    <>
      {order.status === "awaiting_supplier_confirmation" ? (
        <>
          <Button variant="ghost" onClick={onRequestReject}>
            Rechazar
          </Button>
          <Button variant="primary" onClick={onRequestConfirm}>
            Confirmar
          </Button>
        </>
      ) : null}
      {order.status === "paid" ? (
        <Button variant="primary" onClick={handleMarkProcessing} loading={statusActionSubmitting}>
          Marcar en preparación
        </Button>
      ) : null}
      {order.status === "shipped" ? (
        <Button variant="primary" onClick={handleMarkDelivered} loading={statusActionSubmitting}>
          Marcar entregada
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <SlideOver
      open={open}
      onClose={handleClose}
      title={order ? order.orderNumber : "Orden"}
      subtitle={order ? formatDateTime(order.createdAt) : undefined}
      footer={footer}
    >
      {loading || !order ? (
        <FormSkeleton fields={5} />
      ) : (
        <div className="flex flex-col gap-lg">
          <section className="flex flex-col gap-sm">
            <div className="flex items-center gap-sm">
              <OrderStatusBadge status={order.status} />
              <AuthorizationCountdown
                authorizedAt={order.payment.authorizedAt}
                alertHours={alertHours}
                cancelHours={cancelHours}
                adminAlertedAt={order.adminAlertedAt}
              />
            </div>
            {order.cancelReason ? (
              <p className="font-body text-caption text-estado-error">Motivo: {order.cancelReason}</p>
            ) : null}
          </section>

          <section>
            <h3 className="font-ui text-ui text-negro">Cliente</h3>
            {order.customer ? (
              <p className="mt-xs font-body text-body text-negro">
                {order.customer.firstName} {order.customer.lastName} · {order.customer.email}
              </p>
            ) : (
              <p className="mt-xs font-body text-body text-grafito">Cuenta eliminada.</p>
            )}
          </section>

          <section>
            <h3 className="font-ui text-ui text-negro">Líneas</h3>
            <div className="mt-sm">
              <OrderLineList lines={order.lines} />
            </div>
          </section>

          <section>
            <h3 className="font-ui text-ui text-negro">Totales</h3>
            <dl className="mt-sm flex flex-col gap-xs font-body text-body text-negro">
              <div className="flex justify-between">
                <dt className="text-grafito">Subtotal</dt>
                <dd>{formatCurrencyCents(order.totals.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-grafito">IVA (incluido)</dt>
                <dd>{formatCurrencyCents(order.totals.taxCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-grafito">Envío</dt>
                <dd>{formatCurrencyCents(order.totals.shippingCents)}</dd>
              </div>
              <div className="flex justify-between font-ui text-ui">
                <dt>Total</dt>
                <dd>{formatCurrencyCents(order.totals.totalCents)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="font-ui text-ui text-negro">Pago</h3>
            <dl className="mt-sm flex flex-col gap-xs font-body text-body text-negro">
              <div className="flex justify-between">
                <dt className="text-grafito">Proveedor</dt>
                <dd className="uppercase">{order.payment.provider}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-grafito">Captura</dt>
                <dd>{order.payment.captureMethod === "manual" ? "manual" : "automática"}</dd>
              </div>
              {order.payment.authorizedAt ? (
                <div className="flex justify-between">
                  <dt className="text-grafito">Autorizado</dt>
                  <dd>{formatDateTime(order.payment.authorizedAt)}</dd>
                </div>
              ) : null}
              {order.payment.capturedAt ? (
                <div className="flex justify-between">
                  <dt className="text-grafito">Capturado</dt>
                  <dd>{formatDateTime(order.payment.capturedAt)}</dd>
                </div>
              ) : null}
              {order.paymentIntentId ? (
                <div className="flex justify-between gap-sm">
                  <dt className="text-grafito">PaymentIntent</dt>
                  <dd className="truncate font-mono text-caption">{order.paymentIntentId}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="font-ui text-ui text-negro">Dirección de envío</h3>
              {!editingAddress && !ADDRESS_LOCKED_STATUSES.has(order.status) ? (
                <Button variant="text" onClick={() => setEditingAddress(true)}>
                  Editar
                </Button>
              ) : null}
            </div>
            <div className="mt-sm">
              {editingAddress ? (
                <ShippingAddressForm
                  initial={order.shippingAddress}
                  submitting={addressSubmitting}
                  onSubmit={handleAddressSubmit}
                  onCancel={() => setEditingAddress(false)}
                />
              ) : (
                <p className="font-body text-body text-negro">
                  {order.shippingAddress.recipientName} · {order.shippingAddress.street}
                  {order.shippingAddress.interiorNumber ? ` int. ${order.shippingAddress.interiorNumber}` : ""},{" "}
                  {order.shippingAddress.neighborhood}, {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                  {order.shippingAddress.postalCode} · {order.shippingAddress.phone}
                </p>
              )}
            </div>
          </section>

          {SHIPMENT_ELIGIBLE_STATUSES.has(order.status) ? (
            <section>
              <div className="flex items-center justify-between">
                <h3 className="font-ui text-ui text-negro">Paquetería</h3>
                {!editingShipment ? (
                  <Button variant="text" onClick={() => setEditingShipment(true)}>
                    {order.shipment ? "Corregir" : "Capturar guía"}
                  </Button>
                ) : null}
              </div>
              <div className="mt-sm">
                {editingShipment ? (
                  <ShipmentForm
                    submitting={shipmentSubmitting}
                    willTransitionToShipped={order.status === "processing"}
                    initial={
                      order.shipment
                        ? {
                            carrier: order.shipment.carrier,
                            trackingNumber: order.shipment.trackingNumber,
                            ...(order.shipment.carrierName ? { carrierName: order.shipment.carrierName } : {}),
                            trackingUrl: order.shipment.trackingUrl,
                          }
                        : undefined
                    }
                    onSubmit={handleShipmentSubmit}
                  />
                ) : order.shipment ? (
                  <p className="font-body text-body text-negro">
                    {order.shipment.carrierName ?? order.shipment.carrier.toUpperCase()} · guía{" "}
                    {order.shipment.trackingNumber} · enviado {formatDateTime(order.shipment.shippedAt)}
                  </p>
                ) : (
                  <p className="font-body text-body text-grafito">Aún no se ha capturado guía.</p>
                )}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="font-ui text-ui text-negro">Historial</h3>
            <div className="mt-sm">
              <OrderStatusHistoryList entries={order.statusHistory} />
            </div>
          </section>
        </div>
      )}
    </SlideOver>
  );
}
