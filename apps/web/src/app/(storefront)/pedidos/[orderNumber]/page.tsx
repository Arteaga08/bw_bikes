import type { PublicOrder } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ApiError } from "@/lib/api/error";
import { serverApiFetch } from "@/lib/api/server";
import { requireCustomerSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/orders/format";
import { ORDER_STATUS_LABELS, orderStatusBadgeVariant } from "@/lib/orders/status";
import { OrderLinesList } from "./OrderLinesList";
import { OrderSummaryTable } from "./OrderSummaryTable";
import { OrderTimeline } from "./OrderTimeline";

interface OrderDetailPageProps {
  params: Promise<{ orderNumber: string }>;
}

export const metadata: Metadata = { title: "Detalle de pedido" };

/**
 * The one route this milestone leaves outside `/mi-cuenta` on purpose — it's
 * the URL every transactional email already links (`sendOrderPaidEmail` and
 * siblings, `apps/api/src/services/mailer/`), so keeping it here avoids
 * touching those templates.
 */
export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderNumber } = await params;
  await requireCustomerSession(`/pedidos/${orderNumber}`);

  let order: PublicOrder;
  try {
    const { data } = await serverApiFetch<{ order: PublicOrder }>(`/orders/number/${orderNumber}`);
    order = data.order;
  } catch (error) {
    if (error instanceof ApiError && (error.httpStatus === 404 || error.httpStatus === 400)) {
      notFound();
    }
    throw error;
  }

  const showSupplierConfirmationNotice =
    order.payment.captureMethod !== "automatic" && order.status === "awaiting_supplier_confirmation";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-lg px-lg py-xl">
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <p className="font-body text-eyebrow uppercase text-grafito">Pedido</p>
          <h1 className="font-display text-h3 text-negro">{order.orderNumber}</h1>
          <p className="mt-xs font-body text-caption text-grafito">Realizado el {formatDateTime(order.createdAt)}</p>
        </div>
        <Badge variant={orderStatusBadgeVariant(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
      </div>

      {showSupplierConfirmationNotice ? (
        <p className="rounded-control bg-estado-advertencia-soft px-md py-sm font-body text-body text-estado-advertencia">
          El cargo se confirma cuando el proveedor confirme el stock.
        </p>
      ) : null}

      <section className="rounded-card-lg border border-borde bg-surface p-lg">
        <h2 className="font-display text-h4 text-negro">Seguimiento</h2>
        <div className="mt-md">
          <OrderTimeline entries={order.statusHistory} />
        </div>
      </section>

      <section className="rounded-card-lg border border-borde bg-surface p-lg">
        <h2 className="font-display text-h4 text-negro">Productos</h2>
        <div className="mt-md">
          <OrderLinesList lines={order.lines} />
        </div>
      </section>

      <section className="rounded-card-lg border border-borde bg-surface p-lg">
        <h2 className="font-display text-h4 text-negro">Totales</h2>
        <div className="mt-md">
          <OrderSummaryTable totals={order.totals} />
        </div>
      </section>

      <section className="rounded-card-lg border border-borde bg-surface p-lg">
        <h2 className="font-display text-h4 text-negro">Dirección de envío</h2>
        <p className="mt-md font-body text-body text-negro">
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
      </section>

      {order.shipment ? (
        <section className="rounded-card-lg border border-borde bg-surface p-lg">
          <h2 className="font-display text-h4 text-negro">Envío</h2>
          <dl className="mt-md flex flex-col gap-xs font-body text-body text-negro">
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
          </dl>
        </section>
      ) : null}
    </div>
  );
}
