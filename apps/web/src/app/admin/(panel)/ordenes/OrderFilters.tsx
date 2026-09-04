"use client";

import type { OrderPriority } from "@bw-bikes/shared";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  ALL_ORDER_PRIORITIES,
  ALL_ORDER_STATUSES,
  ORDER_PRIORITY_LABELS,
  ORDER_STATUS_GROUP_LABELS,
  ORDER_STATUS_GROUPS,
  ORDER_STATUS_LABELS,
  type OrderStatusGroup,
} from "@/lib/orders/status";

export interface OrderFiltersValue {
  /** A single status, a group's comma-joined csv (`ORDER_STATUS_GROUPS`), or `""` for every status — the same shape the backend's `?status=` now accepts. */
  status: string;
  priority: OrderPriority | "";
  /** Exact-match search by folio, as typed; the caller uppercases it before sending (the backend does exact-match, uppercase). */
  orderNumber: string;
  /** Free-text match on the buyer's name, phone, or account email. */
  search: string;
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

/** Fixed display order for the group options — matches the tile row above (Pendientes → Pagos → Envíos → Problemas). */
const STATUS_GROUP_ORDER: OrderStatusGroup[] = ["action", "progress", "shipping", "problems"];

/**
 * The filters the backend supports (`adminOrderListQuerySchema`): status
 * (single or grouped), priority, exact order number, free-text search, and
 * the sort whitelist.
 */
export function OrderFilters({ value, onChange }: OrderFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-md px-lg py-md">
      <Select
        label="Estatus"
        wrapperClassName="min-w-48"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value })}
      >
        <option value="">Todos</option>
        <optgroup label="Grupos">
          {STATUS_GROUP_ORDER.map((group) => (
            <option key={group} value={ORDER_STATUS_GROUPS[group].join(",")}>
              {ORDER_STATUS_GROUP_LABELS[group]}
            </option>
          ))}
        </optgroup>
        <optgroup label="Estatus individual">
          {ALL_ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </optgroup>
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
        label="Buscar"
        wrapperClassName="min-w-48"
        placeholder="Nombre, correo o teléfono"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
      />

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
