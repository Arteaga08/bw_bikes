"use client";

import type { AdminAuditLog } from "@bw-bikes/shared";
import { SlideOver } from "@/components/ui/SlideOver";

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === undefined) return null;
  return (
    <div>
      <p className="font-ui text-eyebrow text-grafito uppercase">{label}</p>
      <pre className="mt-xs overflow-x-auto rounded-control bg-inset p-md font-body text-caption text-negro">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export interface AuditLogDetailSlideOverProps {
  entry: AdminAuditLog | null;
  onClose: () => void;
}

/** Read-only — `AuditLog` is append-only, so there is nothing here to edit or undo. */
export function AuditLogDetailSlideOver({ entry, onClose }: AuditLogDetailSlideOverProps) {
  return (
    <SlideOver open={entry !== null} onClose={onClose} title={entry?.action ?? ""} subtitle={entry?.module}>
      {entry ? (
        <div className="flex flex-col gap-lg">
          <div className="grid grid-cols-2 gap-md">
            <div>
              <p className="font-ui text-eyebrow text-grafito uppercase">Actor</p>
              <p className="font-body text-body text-negro">
                {entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : entry.actorType === "system" ? "Sistema" : "Cuenta eliminada"}
              </p>
              {entry.actor ? <p className="font-body text-caption text-grafito">{entry.actor.email}</p> : null}
            </div>
            <div>
              <p className="font-ui text-eyebrow text-grafito uppercase">Fecha</p>
              <p className="font-body text-body text-negro">{new Date(entry.createdAt).toLocaleString("es-MX")}</p>
            </div>
            {entry.targetId ? (
              <div>
                <p className="font-ui text-eyebrow text-grafito uppercase">Objetivo</p>
                <p className="font-body text-body text-negro">{entry.targetId}</p>
              </div>
            ) : null}
            {entry.ip ? (
              <div>
                <p className="font-ui text-eyebrow text-grafito uppercase">IP</p>
                <p className="font-body text-body text-negro">{entry.ip}</p>
              </div>
            ) : null}
          </div>
          <JsonBlock label="Antes" value={entry.before} />
          <JsonBlock label="Después" value={entry.after} />
        </div>
      ) : null}
    </SlideOver>
  );
}
