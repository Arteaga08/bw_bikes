"use client";

import type { AdminCustomerSummary, CustomersStats } from "@bw-bikes/shared";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableSkeleton, TableRowActions, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard } from "@/components/ui/StatCard";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { adminCustomersApi, type AdminCustomerListParams } from "@/lib/api/admin-customers";
import { formatCurrencyCents } from "@/lib/format";

const CustomerDetailDrawer = dynamic(
  () => import("./CustomerDetailDrawer").then((module) => module.CustomerDetailDrawer),
  { ssr: false },
);

const SendCouponModal = dynamic(() => import("./SendCouponModal").then((module) => module.SendCouponModal), {
  ssr: false,
});

const PAGE_SIZE = 20;

/** Which slice of the registry the table is showing. Driven by the stat tiles. */
type Segment = "todos" | "compradores" | "recurrentes";

interface DrawerState {
  id: string;
  name: string;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

function formatDate(iso: string | undefined): string {
  return iso ? DATE_FORMATTER.format(new Date(iso)) : "—";
}

function fullName(customer: AdminCustomerSummary): string {
  return `${customer.firstName} ${customer.lastName}`.trim() || customer.email;
}

/**
 * The customer registry (M22), on M20's aggregations.
 *
 * The three tiles at the top are **filters, not decoration** — the same
 * clickable-`StatCard` pattern `OrdersSummaryCards` uses. "Compradores
 * recurrentes" is the segment the shop asked for by name, so reaching it is
 * one click rather than a filter dropdown nobody would find.
 *
 * Every figure here is derived from `Order` at read time, never stored on the
 * user, which is why a refunded order still counts as a purchase but not as
 * money kept — see `customer.service.ts`.
 */
export function ClientesView() {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("todos");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AdminCustomerSummary[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [stats, setStats] = useState<CustomersStats | null>(null);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [couponModalIds, setCouponModalIds] = useState<string[] | null>(null);

  const effectiveParams: AdminCustomerListParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      sort: "-totalSpentCents",
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(segment === "recurrentes" ? { repeatBuyersOnly: true } : {}),
      ...(segment === "compradores" ? { buyersOnly: true } : {}),
    }),
    [page, search, segment],
  );

  const requestKey = JSON.stringify(effectiveParams);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  if (requestKey !== lastRequestKey) {
    setLastRequestKey(requestKey);
    setLoading(true);
    setLoadError(false);
    // Selecting on page 1 and then filtering would otherwise leave an
    // invisible selection the admin could still act on.
    setSelectedIds([]);
  }

  useEffect(() => {
    let cancelled = false;
    adminCustomersApi
      .list(effectiveParams)
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setMeta(result.meta ?? { total: result.data.length, page: 1, pages: 1, limit: PAGE_SIZE });
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
  }, [effectiveParams]);

  // Independent of the list: the tiles describe the whole registry, so they
  // must not change when the admin filters the table with them.
  useEffect(() => {
    let cancelled = false;
    adminCustomersApi
      .stats("365d")
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectSegment(next: Segment): void {
    setSegment((current) => (current === next ? "todos" : next));
    setPage(1);
  }

  function updateSearch(next: string): void {
    setSearch(next);
    setPage(1);
  }

  function toggleSelected(id: string): void {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id],
    );
  }

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  function toggleAllVisible(): void {
    setSelectedIds(allVisibleSelected ? [] : rows.map((row) => row.id));
  }

  const columns: DataTableColumn<AdminCustomerSummary>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          aria-label="Seleccionar todos"
          checked={allVisibleSelected}
          onChange={toggleAllVisible}
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          aria-label={`Seleccionar ${fullName(row)}`}
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleSelected(row.id)}
        />
      ),
    },
    {
      key: "name",
      header: "Cliente",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-ui text-ui text-negro">{fullName(row)}</span>
          <span className="truncate font-body text-caption text-grafito">{row.email}</span>
        </div>
      ),
    },
    { key: "orderCount", header: "Compras", kind: "number", render: (row) => row.orderCount },
    {
      key: "totalSpent",
      header: "Total gastado",
      kind: "number",
      render: (row) => formatCurrencyCents(row.totalSpentCents),
    },
    { key: "lastOrderAt", header: "Última compra", render: (row) => formatDate(row.lastOrderAt) },
    {
      key: "actions",
      header: "Acciones",
      kind: "actions",
      render: (row) => (
        <TableRowActions>
          <Button variant="secondary" size="sm" onClick={() => setDrawer({ id: row.id, name: fullName(row) })}>
            Ver
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCouponModalIds([row.id])}>
            Enviar cupón
          </Button>
        </TableRowActions>
      ),
    },
  ];

  function renderMobileRow(row: AdminCustomerSummary) {
    return (
      <div className="flex flex-col gap-sm">
        <div className="flex flex-col">
          <span className="font-ui text-ui text-negro">{fullName(row)}</span>
          <span className="font-body text-caption text-grafito">{row.email}</span>
        </div>
        <dl className="grid grid-cols-2 gap-xs font-body text-caption text-grafito">
          <div>
            <dt className="inline">Compras: </dt>
            <dd className="inline text-negro">{row.orderCount}</dd>
          </div>
          <div>
            <dt className="inline">Gastado: </dt>
            <dd className="inline text-negro">{formatCurrencyCents(row.totalSpentCents)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="inline">Última compra: </dt>
            <dd className="inline text-negro">{formatDate(row.lastOrderAt)}</dd>
          </div>
        </dl>
        <div className="flex items-center gap-sm">
          <Button variant="secondary" size="sm" onClick={() => setDrawer({ id: row.id, name: fullName(row) })}>
            Ver detalle
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCouponModalIds([row.id])}>
            Enviar cupón
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Quién compra, cuánto y cuántas veces. Las cifras salen de las órdenes: un reembolso sigue contando como compra, pero no como dinero cobrado."
      />

      <div className="grid grid-cols-1 gap-md p-md sm:grid-cols-2 sm:p-lg xl:grid-cols-4">
        {stats === null ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Clientes registrados"
              value={stats.totalCustomers}
              hint="Cuentas de cliente, incluidas las que no han comprado."
              onClick={() => selectSegment("todos")}
              active={segment === "todos"}
            />
            <StatCard
              label="Han comprado"
              value={stats.buyers}
              hint="Con al menos una compra en el último año."
              onClick={() => selectSegment("compradores")}
              active={segment === "compradores"}
            />
            <StatCard
              label="Compradores recurrentes"
              value={stats.repeatBuyers}
              tone="exito"
              hint="Más de una compra. El segmento al que vale la pena mandarle un cupón."
              onClick={() => selectSegment("recurrentes")}
              active={segment === "recurrentes"}
            />
            <StatCard
              label="Ticket promedio"
              value={formatCurrencyCents(stats.averageOrderCents)}
              hint="Sobre las órdenes cobradas del último año."
            />
          </>
        )}
      </div>

      {stats !== null && stats.topBuyers.length > 0 ? (
        <div className="px-md pb-md sm:px-lg sm:pb-lg">
          <ChartCard
            title="Mejores compradores"
            subtitle="Por dinero cobrado en el último año, no por número de compras."
          >
            <RankedBarChart
              items={stats.topBuyers.map((buyer) => ({
                label: buyer.name || buyer.email,
                count: buyer.orderCount,
                revenueCents: buyer.totalSpentCents,
                formatRevenue: formatCurrencyCents,
              }))}
            />
          </ChartCard>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-md px-md py-md sm:px-lg">
        <Input
          label="Buscar"
          placeholder="Nombre o correo"
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
          wrapperClassName="w-full sm:max-w-[18rem]"
        />
      </div>

      {selectedIds.length > 0 ? (
        <div className="mx-md flex flex-wrap items-center justify-between gap-sm rounded-card border border-borde bg-inset p-md sm:mx-lg">
          <p className="font-ui text-ui text-negro">
            {selectedIds.length} cliente{selectedIds.length === 1 ? "" : "s"} seleccionado
            {selectedIds.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-sm">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Limpiar
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCouponModalIds(selectedIds)}>
              Enviar cupón
            </Button>
          </div>
        </div>
      ) : null}

      <ErrorBoundary>
        <div className="p-md sm:p-lg">
          {loading ? (
            <DataTableSkeleton columns={columns} mobile />
          ) : loadError ? (
            <EmptyState
              title="No se pudieron cargar los clientes"
              description="Ocurrió un problema al conectar con el servidor."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No hay clientes con estos filtros"
              description="Ajusta la búsqueda o cambia el segmento."
            />
          ) : (
            <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} mobileRow={renderMobileRow} />
          )}
        </div>
      </ErrorBoundary>

      <div className="px-md sm:px-lg">
        <Pagination meta={meta} onPageChange={setPage} />
      </div>

      {drawer ? (
        <CustomerDetailDrawer customerId={drawer.id} customerName={drawer.name} onClose={() => setDrawer(null)} />
      ) : null}

      {couponModalIds ? (
        <SendCouponModal
          userIds={couponModalIds}
          onClose={() => setCouponModalIds(null)}
          onSent={() => setSelectedIds([])}
        />
      ) : null}
    </>
  );
}
