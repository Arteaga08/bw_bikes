import type { ApiResponseMeta, PublicOrder } from "@bw-bikes/shared";
import { Package } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrencyCents } from "@/lib/format";
import { formatDateShort } from "@/lib/orders/format";
import { ORDER_STATUS_LABELS, orderStatusBadgeVariant } from "@/lib/orders/status";

export interface OrdersHistoryViewProps {
  orders: PublicOrder[];
  meta?: ApiResponseMeta;
}

function pageHref(page: number): string {
  return `/mi-cuenta/pedidos?page=${page}`;
}

/**
 * Server-rendered `?page=` navigation, same mechanism as `CatalogPagination`
 * — no client state, since this list has no filters to carry across pages.
 */
function OrdersHistoryPagination({ meta }: { meta: ApiResponseMeta }) {
  if (meta.pages <= 1) return null;

  return (
    <nav aria-label="Paginación de pedidos" className="flex items-center justify-center gap-lg pt-lg">
      {meta.page > 1 ? (
        <Link href={pageHref(meta.page - 1)} className="font-ui text-ui text-negro hover:underline">
          Anterior
        </Link>
      ) : (
        <span aria-disabled="true" className="font-ui text-ui text-negro-disabled-text">
          Anterior
        </span>
      )}
      <p className="font-body text-body text-grafito">
        Página {meta.page} de {meta.pages}
      </p>
      {meta.page < meta.pages ? (
        <Link href={pageHref(meta.page + 1)} className="font-ui text-ui text-negro hover:underline">
          Siguiente
        </Link>
      ) : (
        <span aria-disabled="true" className="font-ui text-ui text-negro-disabled-text">
          Siguiente
        </span>
      )}
    </nav>
  );
}

export function OrdersHistoryView({ orders, meta }: OrdersHistoryViewProps) {
  const total = meta?.total ?? orders.length;

  return (
    <div>
      <h1 className="font-display text-h3 text-negro">
        Historial de pedidos <span className="text-grafito">· {total} Pedidos</span>
      </h1>

      {orders.length === 0 ? (
        <div className="mt-md">
          <EmptyState
            icon={<Package size={32} weight="regular" aria-hidden="true" />}
            title="Aún no has realizado ningún pedido."
            action={<ButtonLink href="/bicicletas">Ver catálogo</ButtonLink>}
          />
        </div>
      ) : (
        <>
          <ul className="mt-md flex flex-col gap-md">
            {orders.map((order) => (
              <li key={order.id} className="rounded-card-lg border border-borde bg-surface p-lg">
                <div className="flex flex-wrap items-start justify-between gap-md">
                  <div>
                    <p className="font-ui text-ui text-negro">{order.orderNumber}</p>
                    <p className="mt-xs font-body text-caption text-grafito">{formatDateShort(order.createdAt)}</p>
                  </div>
                  <Badge variant={orderStatusBadgeVariant(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                </div>
                <div className="mt-md flex flex-wrap items-center justify-between gap-md">
                  <p className="font-body text-body-l text-negro">{formatCurrencyCents(order.totals.totalCents)}</p>
                  <Link
                    href={`/pedidos/${order.orderNumber}`}
                    className="font-ui text-ui text-negro underline underline-offset-2"
                  >
                    Ver detalle
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {meta ? <OrdersHistoryPagination meta={meta} /> : null}
        </>
      )}
    </div>
  );
}
