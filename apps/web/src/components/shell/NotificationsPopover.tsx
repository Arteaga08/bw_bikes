"use client";

import type { OperationalAlerts } from "@bw-bikes/shared";
import { Bell, CheckCircle } from "@phosphor-icons/react";
import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { useClickOutside } from "@/hooks/use-click-outside";
import { type AlertDescriptor, buildAlertDescriptors } from "@/lib/alerts/alert-descriptors";
import { cn } from "@/lib/cn";

const TONE_CLASSES: Record<AlertDescriptor["tone"], string> = {
  advertencia: "text-estado-advertencia",
  error: "text-estado-error",
};

export interface NotificationsPopoverProps {
  alerts: OperationalAlerts | null;
}

/**
 * The bell's panel — categories grouped by their own color, never a flat
 * mixed list. M11 tried exactly that (one dropdown for every operational
 * alert) and rejected it with Manuel: mixing distinct alerts made them
 * indistinguishable, so `OperationsStrip` on Inicio became the only place
 * to see them. This popover reuses `buildAlertDescriptors`'s per-category
 * classification (icon, label, color) instead of inventing a second one —
 * same source `OperationsStrip` renders, so the two can't drift apart.
 *
 * `pendingApplications` (Solicitudes) is deliberately excluded — it isn't a
 * sale or an inventory problem, and stays visible on Inicio only.
 */
export function NotificationsPopover({ alerts }: NotificationsPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") setOpen(false);
  }

  // `TopBar` re-renders this on every alert poll (every 60s) and on every
  // route change (its own `pathname` read) — memoizing keeps this from
  // rebuilding the descriptor list on renders where `alerts` itself hasn't
  // actually changed.
  const active = useMemo(
    () =>
      alerts
        ? buildAlertDescriptors(alerts).filter((descriptor) => descriptor.key !== "pendingApplications" && descriptor.count > 0)
        : [],
    [alerts],
  );
  const total = useMemo(() => active.reduce((sum, descriptor) => sum + descriptor.count, 0), [active]);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={total ? `Notificaciones: ${total} pendientes` : "Notificaciones"}
        onClick={() => setOpen((value) => !value)}
        className={cn(buttonClasses({ variant: "bare", size: "icon" }), "relative")}
      >
        <Bell size={16} weight="regular" aria-hidden="true" />
        {total ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-estado-error px-1 font-ui text-[10px] leading-none text-blanco"
          >
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-10 mt-xs w-72 rounded-card border border-borde bg-surface p-xs">
          {active.length === 0 ? (
            <div className="flex items-center gap-xs px-sm py-sm text-negro">
              <CheckCircle size={16} weight="regular" aria-hidden="true" className="shrink-0" />
              <span className="font-body text-caption text-grafito">Ventas, pedidos y stock: todo al día.</span>
            </div>
          ) : (
            <ul role="list" className="flex flex-col gap-0.5">
              {active.map((descriptor) => {
                const IconComponent = descriptor.icon;
                return (
                  <li key={descriptor.key}>
                    <Link
                      href={descriptor.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-sm rounded-control px-sm py-sm transition-colors duration-150 hover:bg-base"
                    >
                      <IconComponent
                        size={16}
                        weight="regular"
                        aria-hidden="true"
                        className={cn("shrink-0", TONE_CLASSES[descriptor.tone])}
                      />
                      <span className="min-w-0 flex-1 truncate font-body text-body text-negro">{descriptor.label}</span>
                      <span className={cn("shrink-0 font-ui text-ui", TONE_CLASSES[descriptor.tone])}>{descriptor.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
