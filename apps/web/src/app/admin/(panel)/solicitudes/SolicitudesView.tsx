"use client";

import type { AdminApplication, ApplicationStatus, ApplicationType } from "@bw-bikes/shared";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { DataTableColumn } from "@/components/ui/DataTable";
import { DataTable, DataTableSkeleton, TableRowActions } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Tab, TabList } from "@/components/ui/Tabs";
import { useToast } from "@/hooks/use-toast";
import {
  approveApplication,
  getAdminApplication,
  listAdminApplications,
  rejectApplication,
  type AdminApplicationListParams,
} from "@/lib/api/admin-applications";
import { ApiError } from "@/lib/api/error";
import { ApplicationDetailSlideOver } from "./ApplicationDetailSlideOver";
import { RejectApplicationDialog } from "./RejectApplicationDialog";

const PAGE_SIZE = 20;

const STATUS_TABS: { status: ApplicationStatus; label: string }[] = [
  { status: "pending", label: "Pendientes" },
  { status: "approved", label: "Aprobadas" },
  { status: "rejected", label: "Rechazadas" },
];

const TYPE_LABELS: Record<ApplicationType, string> = {
  ambassador: "Embajador",
  event_sponsorship: "Patrocinio de evento",
};

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Tabs by status (Pendientes is the default — the actual queue of work),
 * with a type filter inside, same shape `OrdersView`'s Cola/Todas split
 * uses: the default tab answers "qué falta atender", not a neutral list.
 */
export function SolicitudesView() {
  const { toast } = useToast();

  const [status, setStatus] = useState<ApplicationStatus>("pending");
  const [type, setType] = useState<ApplicationType | "">("");
  const [page, setPage] = useState(1);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const [rows, setRows] = useState<AdminApplication[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminApplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const effectiveParams: AdminApplicationListParams = useMemo(
    () => ({ page, limit: PAGE_SIZE, status, ...(type ? { type } : {}) }),
    [page, status, type],
  );

  // Same "adjust state during render" pattern every list in this panel
  // uses — a filter/tab change resets to loading right here, while a plain
  // refetch() (after approve/reject) leaves the key unchanged so the table
  // swaps rows without flashing a full skeleton.
  const requestKey = JSON.stringify(effectiveParams);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  if (requestKey !== lastRequestKey) {
    setLastRequestKey(requestKey);
    setLoading(true);
    setLoadError(false);
  }

  useEffect(() => {
    let cancelled = false;
    listAdminApplications(effectiveParams)
      .then((result) => {
        if (cancelled) return;
        setRows(result.data.applications);
        setMeta(result.meta ?? { total: result.data.applications.length, page: 1, pages: 1, limit: PAGE_SIZE });
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

  // The Pendientes tab's badge count — a lightweight `limit: 1` request read
  // only for `meta.total`, independent of whichever tab is currently active.
  useEffect(() => {
    let cancelled = false;
    listAdminApplications({ status: "pending", limit: 1 })
      .then((result) => {
        if (!cancelled) setPendingCount(result.meta?.total ?? 0);
      })
      .catch(() => {
        /* the badge just stays absent — not worth a second error state */
      });
    return () => {
      cancelled = true;
    };
  }, [refetchToken]);

  function refetch(): void {
    setRefetchToken((token) => token + 1);
  }

  function switchTab(nextStatus: ApplicationStatus): void {
    setStatus(nextStatus);
    setPage(1);
  }

  function openDetail(id: string): void {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    getAdminApplication(id)
      .then((application) => setDetail(application))
      .catch((error) => {
        toast({ variant: "error", title: "No se pudo cargar la solicitud", description: apiErrorMessage(error, "Intenta de nuevo.") });
        setDetailId(null);
      })
      .finally(() => setDetailLoading(false));
  }

  function closeDetail(): void {
    setDetailId(null);
    setDetail(null);
  }

  async function handleApprove(): Promise<void> {
    if (!detailId) return;
    setApproveSubmitting(true);
    try {
      await approveApplication(detailId);
      toast({ variant: "success", title: "Solicitud aprobada" });
      closeDetail();
      refetch();
    } catch (error) {
      toast({ variant: "error", title: "No se pudo aprobar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setApproveSubmitting(false);
    }
  }

  async function handleReject(reason: string): Promise<void> {
    if (!detailId) return;
    setRejectSubmitting(true);
    try {
      await rejectApplication(detailId, reason);
      toast({ variant: "success", title: "Solicitud rechazada" });
      setRejectDialogOpen(false);
      closeDetail();
      refetch();
    } catch (error) {
      toast({ variant: "error", title: "No se pudo rechazar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setRejectSubmitting(false);
    }
  }

  const columns: DataTableColumn<AdminApplication>[] = [
    { key: "type", header: "Tipo", kind: "text", render: (row) => TYPE_LABELS[row.type] },
    {
      key: "applicant",
      header: "Solicitante",
      kind: "text",
      render: (row) =>
        row.applicant ? `${row.applicant.firstName} ${row.applicant.lastName}` : <span className="text-grafito">Cuenta eliminada</span>,
    },
    {
      key: "detail",
      header: "Detalle",
      kind: "text",
      render: (row) => row.ambassador?.discipline ?? row.sponsorship?.eventName ?? "—",
    },
    {
      key: "createdAt",
      header: "Recibida",
      kind: "text",
      render: (row) => new Date(row.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
    },
    {
      key: "actions",
      header: "",
      kind: "actions",
      render: (row) => (
        <TableRowActions>
          <Button variant="text" onClick={() => openDetail(row.id)}>
            Ver detalle
          </Button>
        </TableRowActions>
      ),
    },
  ];

  return (
    <>
      <TabList label="Vistas de solicitudes" className="px-md sm:px-lg">
        {STATUS_TABS.map((tab) => (
          <Tab
            key={tab.status}
            selected={status === tab.status}
            onSelect={() => switchTab(tab.status)}
            badge={tab.status === "pending" && pendingCount !== null ? pendingCount : undefined}
          >
            {tab.label}
          </Tab>
        ))}
      </TabList>

      <div className="flex flex-wrap items-end gap-md px-md py-md sm:px-lg">
        <Select
          label="Tipo"
          value={type}
          onChange={(event) => {
            setType(event.target.value as ApplicationType | "");
            setPage(1);
          }}
          wrapperClassName="w-full sm:w-60"
        >
          <option value="">Todos</option>
          <option value="ambassador">Embajador</option>
          <option value="event_sponsorship">Patrocinio de evento</option>
        </Select>
      </div>

      <ErrorBoundary>
        <div className="p-md sm:p-lg">
          {loading ? (
            <DataTableSkeleton columns={columns} />
          ) : loadError ? (
            <EmptyState
              title="No se pudieron cargar las solicitudes"
              description="Ocurrió un problema al conectar con el servidor."
              action={
                <Button variant="ghost" onClick={refetch}>
                  Reintentar
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={status === "pending" ? "No hay solicitudes pendientes" : "No hay solicitudes con estos filtros"}
              description={status === "pending" ? "Todo al día." : "Ajusta el filtro de tipo."}
            />
          ) : (
            <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />
          )}
        </div>
      </ErrorBoundary>

      <div className="px-md sm:px-lg">
        <Pagination meta={meta} onPageChange={setPage} />
      </div>

      <ApplicationDetailSlideOver
        application={detail}
        loading={detailId !== null && detailLoading}
        onClose={closeDetail}
        onApprove={() => void handleApprove()}
        onReject={() => setRejectDialogOpen(true)}
        approveSubmitting={approveSubmitting}
      />

      <RejectApplicationDialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        onConfirm={handleReject}
        submitting={rejectSubmitting}
      />
    </>
  );
}
