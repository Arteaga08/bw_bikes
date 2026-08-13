"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { forwardRef } from "react";

export interface ErrorSummaryEntry {
  /** The id of the field (or section, when the error has no single field — e.g. duplicate SKUs) this entry jumps to. */
  targetId: string;
  message: string;
}

export interface ErrorSummaryProps {
  entries: ErrorSummaryEntry[];
}

/**
 * Announced as `role="alert"` and focused by `ProductEditor` right after a
 * failed `validate()` — the admin lands here instead of having to hunt six
 * sections for the one red border. Each entry is a real `<button>`, not an
 * anchor: jumping to a field shouldn't push a history entry.
 */
export const ErrorSummary = forwardRef<HTMLDivElement, ErrorSummaryProps>(function ErrorSummary({ entries }, ref) {
  if (entries.length === 0) return null;

  function jumpTo(targetId: string): void {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target.focus();
  }

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="flex flex-col gap-sm rounded-card border border-estado-error bg-estado-error-soft p-md focus:outline-none"
    >
      <div className="flex items-center gap-xs font-ui text-ui text-estado-error">
        <WarningCircle aria-hidden="true" size={18} weight="fill" />
        {entries.length === 1 ? "Revisa 1 campo antes de guardar" : `Revisa ${entries.length} campos antes de guardar`}
      </div>
      <ul className="flex flex-col gap-xs pl-lg">
        {entries.map((entry) => (
          <li key={entry.targetId} className="list-disc font-body text-caption text-estado-error marker:text-estado-error">
            <button
              type="button"
              onClick={() => jumpTo(entry.targetId)}
              className="text-left underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
            >
              {entry.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});
