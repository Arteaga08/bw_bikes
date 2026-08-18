"use client";

import type { AdminAuditLog, AuditAction } from "@bw-bikes/shared";
import { AUDIT_ACTIONS } from "@bw-bikes/shared";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import type { DataTableColumn } from "@/components/ui/DataTable";
import { DataTable, DataTableSkeleton, TableRowActions } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { listAdminAuditLogs, type AdminAuditLogListParams } from "@/lib/api/admin-audit-logs";
import { AuditLogDetailSlideOver } from "./AuditLogDetailSlideOver";

const PAGE_SIZE = 30;

interface Filters {
  module: string;
  action: AuditAction | "";
}

const EMPTY_FILTERS: Filters = { module: "", action: "" };

/**
 * Filtros (módulo, acción, rango de fechas) → tabla → detalle. Solo lectura:
 * `AuditLog` es append-only, así que no hay ninguna acción de escritura en
 * esta pantalla.
 */
export function AuditLogView() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AdminAuditLog[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  const [selected, setSelected] = useState<AdminAuditLog | null>(null);

  const effectiveParams: AdminAuditLogListParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(filters.module.trim() ? { module: filters.module.trim() } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
    }),
    [page, filters, from, to],
  );

  const requestKey = JSON.stringify(effectiveParams);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  if (requestKey !== lastRequestKey) {
    setLastRequestKey(requestKey);
    setLoading(true);
    setLoadError(false);
  }

  useEffect(() => {
    let cancelled = false;
    listAdminAuditLogs(effectiveParams)
      .then((result) => {
        if (cancelled) return;
        setRows(result.data.logs);
        setMeta(result.meta ?? { total: result.data.logs.length, page: 1, pages: 1, limit: PAGE_SIZE });
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveParams, refetchToken]);

  function refetch(): void {
    setRefetchToken((token) => token + 1);
  }

  function updateFilters(next: Partial<Filters>): void {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  const columns: DataTableColumn<AdminAuditLog>[] = [
    {
      key: "createdAt",
      header: "Fecha",
      kind: "text",
      render: (row) => new Date(row.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }),
    },
    {
      key: "actor",
      header: "Actor",
      kind: "text",
      render: (row) =>
        row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : row.actorType === "system" ? "Sistema" : "—",
    },
    { key: "action", header: "Acción", kind: "text", render: (row) => row.action },
    { key: "module", header: "Módulo", kind: "status", render: (row) => <Badge variant="neutral">{row.module}</Badge> },
    { key: "targetId", header: "Objetivo", kind: "text", render: (row) => row.targetId ?? "—" },
    {
      key: "actions",
      header: "",
      kind: "actions",
      render: (row) => (
        <TableRowActions>
          <Button variant="text" onClick={() => setSelected(row)}>
            Ver detalle
          </Button>
        </TableRowActions>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end gap-md px-md py-md sm:px-lg">
        <Input
          label="Módulo"
          placeholder="inventory, settings, catalog.bikes…"
          value={filters.module}
          onChange={(event) => updateFilters({ module: event.target.value })}
          wrapperClassName="w-full sm:w-56"
        />
        <Select
          label="Acción"
          value={filters.action}
          onChange={(event) => updateFilters({ action: event.target.value as AuditAction | "" })}
          wrapperClassName="w-full sm:w-64"
        >
          <option value="">Todas</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          label="Desde"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(1);
          }}
          wrapperClassName="w-full sm:w-40"
        />
        <Input
          type="date"
          label="Hasta"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setPage(1);
          }}
          wrapperClassName="w-full sm:w-40"
        />
      </div>

      <ErrorBoundary>
        <div className="p-md sm:p-lg">
          {loading ? (
            <DataTableSkeleton columns={columns} />
          ) : loadError ? (
            <EmptyState
              title="No se pudo cargar la bitácora"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState title="Sin entradas con estos filtros" description="Ajusta el módulo, la acción o el rango de fechas." />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.id}
              minWidthClassName="min-w-[56rem]"
            />
          )}
        </div>
      </ErrorBoundary>

      <div className="px-md sm:px-lg">
        <Pagination meta={meta} onPageChange={setPage} />
      </div>

      <AuditLogDetailSlideOver entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}
