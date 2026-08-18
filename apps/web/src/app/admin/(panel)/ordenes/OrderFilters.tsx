"use client";

import type { OrderPriority, OrderStatus } from "@bw-bikes/shared";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ALL_ORDER_PRIORITIES, ALL_ORDER_STATUSES, ORDER_PRIORITY_LABELS, ORDER_STATUS_LABELS } from "@/lib/orders/status";

export interface OrderFiltersValue {
  status: OrderStatus | "";
  priority: OrderPriority | "";
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
  { value: "priority", label: "Prioridad" },
];

/**
 * Only the filters the backend actually supports
 * (`adminOrderListQuerySchema`): status, priority, exact order number, and
 * the sort whitelist. No free-text search, no date range, no customer/amount
 * filter — the list endpoint doesn't accept them, so offering them here
 * would just produce a silently-ignored control.
 */
export function OrderFilters({ value, onChange }: OrderFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-md px-lg py-md">
      <Select
        label="Estatus"
        wrapperClassName="min-w-40"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as OrderStatus | "" })}
      >
        <option value="">Todos</option>
        {ALL_ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>

      <Select
        label="Prioridad"
        wrapperClassName="min-w-32"
        value={value.priority}
        onChange={(event) => onChange({ ...value, priority: event.target.value as OrderPriority | "" })}
      >
        <option value="">Todas</option>
        {ALL_ORDER_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {ORDER_PRIORITY_LABELS[priority]}
          </option>
        ))}
      </Select>

      <Input
        label="Número de orden"
        wrapperClassName="min-w-48"
        placeholder="BW-2026-K7XQ2M"
        value={value.orderNumber}
        onChange={(event) => onChange({ ...value, orderNumber: event.target.value })}
      />

      <Select
        label="Ordenar por"
        wrapperClassName="min-w-48"
        value={value.sort}
        onChange={(event) => onChange({ ...value, sort: event.target.value })}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
