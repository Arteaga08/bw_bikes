"use client";

import type { OrderInternalNote } from "@bw-bikes/shared";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { formatDateTime } from "@/lib/orders/format";

// Mirrors `MAX_INTERNAL_NOTE_LENGTH` (apps/api/src/models/schemas/internal-note.schema.ts).
// Not imported — apps/web never imports apps/api source.
const MAX_NOTE_LENGTH = 1000;

export interface OrderInternalNotesProps {
  notes: OrderInternalNote[];
  onAddNote: (body: string) => Promise<boolean>;
  submitting: boolean;
}

/**
 * Staff-only, append-only — the field the "categoría" table asked for
 * ("cliente llamó molesto por retraso, enviar regalo compensatorio").
 * Chronological, oldest first, same convention as `OrderStatusHistoryList`:
 * both render the array in the order the API returns it, which is push
 * order on the backend.
 */
export function OrderInternalNotes({ notes, onAddNote, submitting }: OrderInternalNotesProps) {
  const [draft, setDraft] = useState("");
  const trimmedLength = draft.trim().length;
  const isValid = trimmedLength > 0 && trimmedLength <= MAX_NOTE_LENGTH;

  async function handleSubmit(): Promise<void> {
    if (!isValid) return;
    const ok = await onAddNote(draft.trim());
    if (ok) setDraft("");
  }

  return (
    <div className="flex flex-col gap-md">
      {notes.length > 0 ? (
        <ul className="flex flex-col gap-sm">
          {notes.map((note, index) => (
            <li key={`${note.createdAt}-${index}`} className="rounded-card border border-borde bg-surface p-md">
              <p className="font-body text-body text-negro">{note.body}</p>
              <p className="mt-xs font-body text-caption text-grafito">
                {note.authorName} · {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-caption text-grafito">Sin notas internas todavía.</p>
      )}

      <div className="flex flex-col gap-xs">
        <Textarea
          label="Agregar nota interna"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          helper={`${trimmedLength}/${MAX_NOTE_LENGTH} caracteres`}
          disabled={submitting}
        />
        <Button variant="ghost" onClick={handleSubmit} disabled={!isValid} loading={submitting} className="self-end">
          Agregar nota
        </Button>
      </div>
    </div>
  );
}
