"use client";

import type { AdminOrder, OrderActivityEntry, OrderPriority, ShippingAddress } from "@bw-bikes/shared";
import {
  CheckCircle,
  ClockCounterClockwise,
  CreditCard,
  Copy,
  FileText,
  Hash,
  MapPin,
  NoteBlank,
  Package,
  Receipt,
  Truck,
  User,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { FormSkeleton } from "@/components/ui/Skeleton";
import type { RecordShipmentInput } from "@/lib/api/admin-orders";
import { buildOrderTimeline } from "@/lib/orders/activity";
import { formatCurrencyCents } from "@/lib/format";
import { formatDateTime } from "@/lib/orders/format";
import { ALL_ORDER_PRIORITIES, ORDER_PRIORITY_LABELS, shipmentEligibility } from "@/lib/orders/status";
import { AuthorizationCountdown } from "./AuthorizationCountdown";
import { DisputeStatusBadge } from "./DisputeStatusBadge";
import { OrderActivityList } from "./OrderActivityList";
import { OrderDetailCard } from "./OrderDetailCard";
import { OrderInternalNotes } from "./OrderInternalNotes";
import { OrderLineList } from "./OrderLineList";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStateBadge } from "./PaymentStateBadge";
import { ShipmentForm } from "./ShipmentForm";
import { ShippingAddressForm } from "./ShippingAddressForm";

// Mirrors updateShippingAddress's own guard in order.service.ts.
const ADDRESS_LOCKED_STATUSES = new Set(["shipped", "delivered", "cancelled", "refunded", "authorization_expired"]);

// The "Logística de envío" card's placeholder copy for the two statuses
// `shipmentEligibility` doesn't hand a form or a captured shipment to show —
// so the card explains *why* there's nothing to capture instead of vanishing
// outright, which used to read as "the tracking feature is missing".
const SHIPMENT_NOT_YET_COPY = "Disponible cuando la orden esté en preparación.";
const SHIPMENT_NEVER_COPY = "Esta orden no se enviará.";

/**
 * Where an order ships. Captured by the customer on the cart before checkout
 * (see `PublicCart.shippingAddress` / `PUT /cart/shipping-address`) and copied
 * onto the order as a snapshot at checkout time, same reasoning as
 * `OrderLineSnapshot`: an address the customer edits later must not silently
 * rewrite where an already-placed order was told to go.
 *
 * `AdminOrder.shippingAddress` is `required` end to end (the Mongoose schema
 * and `createFromCart` both enforce it — no real checkout can produce an
 * order without one), but this dev database is shared across sessions and
 * accumulates records from before that guarantee existed. Rather than trust
 * the type and crash the whole panel on one anomalous document, this is the
 * blank form `ShippingAddressForm` starts from when `order.shippingAddress`
 * is unexpectedly absent — capturing it here is also how that record gets
 * repaired, via the same `PATCH /admin/orders/:id/shipping-address` any
 * other edit uses.
 */
const EMPTY_SHIPPING_ADDRESS: ShippingAddress = {
  firstName: "",
  lastName: "",
  phone: "",
  street: "",
  neighborhood: "",
  city: "",
  state: "Ciudad de México",
  postalCode: "",
  country: "MX",
};

export interface OrderDetailModalProps {
  order: AdminOrder | null;
  loading: boolean;
  activity: OrderActivityEntry[];
  onClose: () => void;
  alertHours: number;
  cancelHours: number;
  onRequestConfirm: () => void;
  onRequestReject: () => void;
  onMarkProcessing: () => Promise<boolean>;
  onMarkDelivered: () => Promise<boolean>;
  onRecordShipment: (input: RecordShipmentInput) => Promise<boolean>;
  onUpdateShippingAddress: (address: ShippingAddress) => Promise<boolean>;
  onUpdatePriority: (priority: OrderPriority) => Promise<boolean>;
  onAddNote: (body: string) => Promise<boolean>;
}

/**
 * Lazy-loaded (`next/dynamic`, see `OrdersView.tsx`) — replaces M9's
 * `OrderDetailSlideOver`. Two columns on `md+` (`Modal size="lg"`): the main
 * column is the order itself (lines, totals, fulfillment), the side column
 * is everything about *this specific* order that isn't the purchase — who,
 * how it was paid, and staff-only context. Confirm/reject stay dialogs owned
 * by `OrdersView` (the queue row and this footer must trigger the *same*
 * dialog instance); shipment, address, priority and notes are all local
 * inline state this component owns, since none of them ever needs to leave
 * the panel.
 *
 * Every section is an `OrderDetailCard` — a bordered `bg-inset` panel with
 * its own icon+title — instead of a bare heading floating on the modal's
 * own `bg-surface`, which used to read as one flat ticket with no
 * separation between "who bought it" and "how it's paid".
 */
export function OrderDetailModal({
  order,
  loading,
  activity,
  onClose,
  alertHours,
  cancelHours,
  onRequestConfirm,
  onRequestReject,
  onMarkProcessing,
  onMarkDelivered,
  onRecordShipment,
  onUpdateShippingAddress,
  onUpdatePriority,
  onAddNote,
}: OrderDetailModalProps) {
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingShipment, setEditingShipment] = useState(false);
  const [shipmentJustSaved, setShipmentJustSaved] = useState(false);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [shipmentSubmitting, setShipmentSubmitting] = useState(false);
  const [statusActionSubmitting, setStatusActionSubmitting] = useState(false);
  const [prioritySubmitting, setPrioritySubmitting] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const open = order !== null || loading;

  // Same confirmation window as `useAsyncAction` (DESIGN_SYSTEM.md §4.4) —
  // held here rather than in `ShipmentForm` because the form unmounts the
  // instant `editingShipment` flips, and it's this component that owns that
  // flag; delaying the flip is what gives the button's `success` state a
  // window to actually be seen before the read view replaces the form.
  const shipmentSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (shipmentSavedTimer.current) clearTimeout(shipmentSavedTimer.current);
    };
  }, []);

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
    if (ok) {
      setShipmentJustSaved(true);
      shipmentSavedTimer.current = setTimeout(() => {
        setShipmentJustSaved(false);
        setEditingShipment(false);
      }, 2000);
    }
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

  async function handlePriorityChange(priority: OrderPriority): Promise<void> {
    setPrioritySubmitting(true);
    await onUpdatePriority(priority);
    setPrioritySubmitting(false);
  }

  async function handleAddNote(body: string): Promise<boolean> {
    setNoteSubmitting(true);
    const ok = await onAddNote(body);
    setNoteSubmitting(false);
    return ok;
  }

  async function handleCopyId(): Promise<void> {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied — not worth a toast over an internal id.
    }
  }

  function handleClose(): void {
    setEditingAddress(false);
    setEditingShipment(false);
    if (shipmentSavedTimer.current) clearTimeout(shipmentSavedTimer.current);
    setShipmentJustSaved(false);
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

  const eligibility = order ? shipmentEligibility(order.status) : "not_yet";

  return (
    <Modal open={open} onClose={handleClose} title={order ? order.orderNumber : "Orden"} size="lg" footer={footer}>
      {loading || !order ? (
        <FormSkeleton fields={6} />
      ) : (
        <div className="flex flex-col gap-lg">
          {/* Header strip — status/payment/countdown on the left, the one
              standing control (priority) on the right, so neither has to
              hide inside a column meant for something else. */}
          <div className="flex flex-wrap items-start justify-between gap-md">
            <div className="flex flex-col gap-sm">
              <div className="flex flex-wrap items-center gap-sm">
                <OrderStatusBadge status={order.status} />
                <PaymentStateBadge state={order.payment.state} />
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
            </div>
            <Select
              label="Prioridad"
              value={order.priority}
              disabled={prioritySubmitting}
              onChange={(event) => void handlePriorityChange(event.target.value as OrderPriority)}
              wrapperClassName="w-40 shrink-0"
            >
              {ALL_ORDER_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {ORDER_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-lg md:grid-cols-[minmax(0,1fr)_20rem]">
            {/* Main column — the purchase itself. */}
            <div className="flex flex-col gap-lg">
              <OrderDetailCard icon={Package} title="Líneas">
                <OrderLineList lines={order.lines} />
              </OrderDetailCard>

              <OrderDetailCard icon={Receipt} title="Totales">
                <dl className="flex flex-col gap-xs font-body text-body text-negro">
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
                  <div className="mt-xs flex items-center justify-between border-t border-borde pt-xs">
                    <dt className="font-ui text-body-l text-negro">Total</dt>
                    <dd className="rounded-control bg-dorado px-sm py-xs font-ui text-body-l text-negro">
                      {formatCurrencyCents(order.totals.totalCents)}
                    </dd>
                  </div>
                </dl>
              </OrderDetailCard>

              <OrderDetailCard
                icon={MapPin}
                title="Dirección de envío"
                action={
                  !editingAddress && !ADDRESS_LOCKED_STATUSES.has(order.status) ? (
                    <Button variant="text" onClick={() => setEditingAddress(true)}>
                      Editar
                    </Button>
                  ) : undefined
                }
              >
                {editingAddress ? (
                  <ShippingAddressForm
                    initial={order.shippingAddress ?? EMPTY_SHIPPING_ADDRESS}
                    submitting={addressSubmitting}
                    onSubmit={handleAddressSubmit}
                    onCancel={() => setEditingAddress(false)}
                  />
                ) : order.shippingAddress ? (
                  <p className="font-body text-body text-negro">
                    {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                    <br />
                    {order.shippingAddress.street}
                    {order.shippingAddress.interiorNumber ? ` int. ${order.shippingAddress.interiorNumber}` : ""},{" "}
                    {order.shippingAddress.neighborhood}
                    <br />
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                    <br />
                    {order.shippingAddress.phone}
                  </p>
                ) : (
                  <p className="font-body text-body text-grafito">Sin dirección de envío registrada.</p>
                )}
                {!order.shippingAddress && !editingAddress ? (
                  <p className="mt-xs font-body text-caption text-estado-error">
                    Registro incompleto — captúrala con &quot;Editar&quot; para corregirlo.
                  </p>
                ) : null}
              </OrderDetailCard>

              {/* Lives here, not in the side column — it's the one section that
                  keeps growing over an order's lifetime, and the main column
                  (líneas + totales + dirección) otherwise runs out well before
                  the side column does, leaving a tall blank gap beside it. */}
              <OrderDetailCard icon={ClockCounterClockwise} title="Bitácora">
                <OrderActivityList entries={buildOrderTimeline(order.statusHistory, activity)} />
              </OrderDetailCard>
            </div>

            {/* Side column — who, how paid, and staff-only context. */}
            <div className="flex flex-col gap-lg">
              <OrderDetailCard
                icon={Truck}
                title="Logística de envío"
                action={
                  eligibility === "eligible" && !editingShipment ? (
                    <Button variant="text" onClick={() => setEditingShipment(true)}>
                      {order.shipment ? "Corregir" : "Capturar guía"}
                    </Button>
                  ) : undefined
                }
              >
                {eligibility === "not_yet" ? (
                  <p className="font-body text-body text-grafito">{SHIPMENT_NOT_YET_COPY}</p>
                ) : eligibility === "never" ? (
                  <p className="font-body text-body text-grafito">{SHIPMENT_NEVER_COPY}</p>
                ) : editingShipment ? (
                  <ShipmentForm
                    submitting={shipmentSubmitting}
                    success={shipmentJustSaved}
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
                  <div className="flex flex-col gap-sm">
                    <p className="flex items-center gap-xs rounded-control bg-estado-exito-soft px-sm py-xs font-ui text-caption text-estado-exito">
                      <CheckCircle size={14} aria-hidden="true" />
                      Guía capturada
                    </p>
                    <dl className="flex flex-col gap-xs font-body text-body text-negro">
                      <div className="flex justify-between gap-sm">
                        <dt className="text-grafito">Paquetería</dt>
                        <dd>{order.shipment.carrierName ?? order.shipment.carrier.toUpperCase()}</dd>
                      </div>
                      <div className="flex justify-between gap-sm">
                        <dt className="text-grafito">Guía</dt>
                        <dd className="truncate">
                          <a
                            href={order.shipment.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-borde underline-offset-2 hover:text-negro"
                          >
                            {order.shipment.trackingNumber}
                          </a>
                        </dd>
                      </div>
                      <div className="flex justify-between gap-sm">
                        <dt className="text-grafito">Enviado</dt>
                        <dd>{formatDateTime(order.shipment.shippedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <p className="font-body text-body text-grafito">Aún no se ha capturado guía.</p>
                )}
              </OrderDetailCard>

              <OrderDetailCard icon={User} title="Cliente">
                {order.customer ? (
                  <p className="font-body text-body text-negro">
                    {order.customer.firstName} {order.customer.lastName}
                    <br />
                    {order.customer.email}
                    <br />
                    {order.shippingAddress?.phone ?? "—"}
                  </p>
                ) : (
                  <p className="font-body text-body text-grafito">Cuenta eliminada.</p>
                )}
              </OrderDetailCard>

              <OrderDetailCard icon={CreditCard} title="Pago">
                <dl className="flex flex-col gap-xs font-body text-body text-negro">
                  <div className="flex justify-between">
                    <dt className="text-grafito">Proveedor</dt>
                    <dd className="uppercase">{order.payment.provider}</dd>
                  </div>
                  {order.payment.card ? (
                    <div className="flex justify-between">
                      <dt className="text-grafito">Tarjeta</dt>
                      <dd className="capitalize">
                        {order.payment.card.brand} •••• {order.payment.card.last4}
                      </dd>
                    </div>
                  ) : null}
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
                  {order.disputeStatus ? (
                    <div className="flex items-center justify-between">
                      <dt className="text-grafito">Contracargo</dt>
                      <dd>
                        <DisputeStatusBadge status={order.disputeStatus} />
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </OrderDetailCard>

              <OrderDetailCard icon={Hash} title="Identificación">
                <dl className="flex flex-col gap-xs font-body text-body text-negro">
                  <div className="flex items-center justify-between gap-sm">
                    <dt className="text-grafito">ID interno</dt>
                    <dd className="flex items-center gap-xs">
                      <span className="truncate font-mono text-caption">{order.id}</span>
                      <Button variant="bare" size="icon-sm" aria-label="Copiar ID interno" onClick={() => void handleCopyId()}>
                        <Copy size={14} aria-hidden="true" />
                      </Button>
                      {copied ? <span className="text-caption text-estado-exito">Copiado</span> : null}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-grafito">Creada</dt>
                    <dd>{formatDateTime(order.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-grafito">Actualizada</dt>
                    <dd>{formatDateTime(order.updatedAt)}</dd>
                  </div>
                </dl>
              </OrderDetailCard>

              {order.billingInfo ? (
                <OrderDetailCard icon={FileText} title="Datos fiscales">
                  <p className="font-body text-body text-negro">
                    {order.billingInfo.legalName} · RFC {order.billingInfo.rfc}
                    <br />
                    {order.billingInfo.taxRegime} · CP {order.billingInfo.postalCode}
                  </p>
                </OrderDetailCard>
              ) : null}

              <OrderDetailCard icon={NoteBlank} title="Notas internas">
                <OrderInternalNotes notes={order.internalNotes} onAddNote={handleAddNote} submitting={noteSubmitting} />
              </OrderDetailCard>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
