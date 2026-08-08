"use client";

import type { OrderStatus } from "@bw-bikes/shared";
import { ALL_ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/orders/status";

export interface OrderFiltersValue {
  status: OrderStatus | "";
  /** Free text as typed; the caller uppercases it before sending (the backend does exact-match, uppercase). */
  orderNumber: string;
  sort: string;
}

export interface OrderFiltersProps {
  value: OrderFiltersValue;
  onChange: (value: OrderFiltersValue) => void;
}

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "-createdAt", label: "Más recientes primero" },
  { value: "createdAt", label: "Más antiguas primero" },
  { value: "-totalCents", label: "Monto: mayor a menor" },
  { value: "totalCents", label: "Monto: menor a mayor" },
  { value: "status", label: "Estatus" },
];

/**
 * Only the filters the backend actually supports
 * (`adminOrderListQuerySchema`): status, exact order number, and the
 * three-field sort whitelist. No free-text search, no date range, no
 * customer/amount filter — the list endpoint doesn't accept them, so
 * offering them here would just produce a silently-ignored control.
 */
export function OrderFilters({ value, onChange }: OrderFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-md px-lg py-md">
      <div className="flex flex-col gap-xs">
        <label htmlFor="order-status-filter" className="font-ui text-ui text-negro">
          Estatus
        </label>
        <select
          id="order-status-filter"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as OrderStatus | "" })}
          className="h-11 rounded-control border border-borde bg-surface px-md font-body text-body text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
        >
          <option value="">Todos</option>
          {ALL_ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-xs">
        <label htmlFor="order-number-filter" className="font-ui text-ui text-negro">
          Número de orden
        </label>
        <input
          id="order-number-filter"
          type="text"
          placeholder="BW-2026-K7XQ2M"
          value={value.orderNumber}
          onChange={(event) => onChange({ ...value, orderNumber: event.target.value })}
          className="h-11 rounded-control border border-borde bg-surface px-md font-body text-body text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
        />
      </div>

      <div className="flex flex-col gap-xs">
        <label htmlFor="order-sort-filter" className="font-ui text-ui text-negro">
          Ordenar por
        </label>
        <select
          id="order-sort-filter"
          value={value.sort}
          onChange={(event) => onChange({ ...value, sort: event.target.value })}
          className="h-11 rounded-control border border-borde bg-surface px-md font-body text-body text-negro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
