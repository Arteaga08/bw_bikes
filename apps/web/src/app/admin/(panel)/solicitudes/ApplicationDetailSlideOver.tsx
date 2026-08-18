"use client";

import type { AdminApplication } from "@bw-bikes/shared";
import { FilePdf, Image as ImageIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";

const TYPE_LABELS: Record<AdminApplication["type"], string> = {
  ambassador: "Embajador",
  event_sponsorship: "Patrocinio de evento",
};

const STATUS_VARIANT: Record<AdminApplication["status"], "advertencia" | "exito" | "error"> = {
  pending: "advertencia",
  approved: "exito",
  rejected: "error",
};

const STATUS_LABELS: Record<AdminApplication["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-ui text-eyebrow text-grafito uppercase">{label}</p>
      <p className="font-body text-body text-negro">{value}</p>
    </div>
  );
}

export interface ApplicationDetailSlideOverProps {
  application: AdminApplication | null;
  loading: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  approveSubmitting: boolean;
}

/**
 * Attachments carry short-lived signed Cloudinary URLs, regenerated on every
 * read (`application.service.ts`) — opened directly in a new tab, never
 * cached in state, since the URL this render has may already be stale by
 * the next.
 */
export function ApplicationDetailSlideOver({
  application,
  loading,
  onClose,
  onApprove,
  onReject,
  approveSubmitting,
}: ApplicationDetailSlideOverProps) {
  return (
    <SlideOver
      open={application !== null || loading}
      onClose={onClose}
      title={application ? TYPE_LABELS[application.type] : "Cargando…"}
      subtitle={application?.applicant ? `${application.applicant.firstName} ${application.applicant.lastName}` : undefined}
      footer={
        application && application.status === "pending" ? (
          <>
            <Button variant="ghost" tone="danger" onClick={onReject}>
              Rechazar
            </Button>
            <Button variant="primary" loading={approveSubmitting} onClick={onApprove}>
              Aprobar
            </Button>
          </>
        ) : undefined
      }
    >
      {!application ? (
        <p className="font-body text-body text-grafito">Cargando solicitud…</p>
      ) : (
        <div className="flex flex-col gap-lg">
          <div className="flex items-center gap-sm">
            <Badge variant={STATUS_VARIANT[application.status]}>{STATUS_LABELS[application.status]}</Badge>
          </div>

          {application.applicant ? (
            <div className="grid grid-cols-2 gap-md">
              <Field label="Correo" value={application.applicant.email} />
            </div>
          ) : (
            <p className="font-body text-caption text-grafito">La cuenta de esta persona ya no existe.</p>
          )}

          {application.ambassador ? (
            <div className="grid grid-cols-2 gap-md">
              <Field label="Disciplina" value={application.ambassador.discipline} />
              <Field label="Ciudad" value={application.ambassador.city} />
              <Field label="Red social" value={application.ambassador.socialMediaHandle} />
              <Field label="Seguidores aprox." value={String(application.ambassador.followersApprox)} />
              <div className="col-span-2">
                <Field label="Motivación" value={application.ambassador.motivation} />
              </div>
            </div>
          ) : null}

          {application.sponsorship ? (
            <div className="grid grid-cols-2 gap-md">
              <Field label="Evento" value={application.sponsorship.eventName} />
              <Field label="Fecha" value={application.sponsorship.eventDate} />
              <Field label="Sede" value={application.sponsorship.venue} />
              <Field label="Asistentes esperados" value={String(application.sponsorship.expectedAttendees)} />
              <div className="col-span-2">
                <Field label="Apoyo solicitado" value={application.sponsorship.supportRequested} />
              </div>
            </div>
          ) : null}

          {application.attachments.length > 0 ? (
            <div>
              <p className="font-ui text-eyebrow text-grafito uppercase">Adjuntos</p>
              <ul className="mt-xs flex flex-col gap-xs">
                {application.attachments.map((attachment, index) => (
                  <li key={`${attachment.originalName}-${index}`}>
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-xs font-ui text-ui text-negro underline decoration-borde underline-offset-2 hover:text-grafito"
                    >
                      {attachment.format === "pdf" ? (
                        <FilePdf size={16} aria-hidden="true" />
                      ) : (
                        <ImageIcon size={16} aria-hidden="true" />
                      )}
                      {attachment.originalName}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {application.status === "rejected" && application.rejectionReason ? (
            <div>
              <p className="font-ui text-eyebrow text-grafito uppercase">Motivo del rechazo</p>
              <p className="font-body text-body text-estado-error">{application.rejectionReason}</p>
            </div>
          ) : null}
        </div>
      )}
    </SlideOver>
  );
}
