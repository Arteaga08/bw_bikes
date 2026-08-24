import type { OperationalAlerts } from "@bw-bikes/shared";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { type AlertDescriptor, buildAlertDescriptors } from "@/lib/alerts/alert-descriptors";
import { cn } from "@/lib/cn";

export interface OperationsStripProps {
  alerts: OperationalAlerts;
}

const ROW_TONE_CLASSES: Record<AlertDescriptor["tone"], string> = {
  advertencia: "text-estado-advertencia",
  error: "text-estado-error",
};

const FEATURED_TONE_CLASSES: Record<AlertDescriptor["tone"], string> = {
  advertencia: "bg-estado-advertencia-soft text-estado-advertencia",
  error: "bg-estado-error-soft text-estado-error",
};

/**
 * The accionable half of Inicio. Replaces a row of four AlertCard tiles that
 * always rendered the same size — including the two counts `page.tsx` used
 * to merge into one "Problemas con órdenes" tile, which erased the
 * difference between "an authorization expires in hours" and "a payment
 * has sat unreconciled for days". Every source count still comes from the
 * single unwindowed `/admin/stats/alerts` fetch in `page.tsx`; this
 * component only orders and renders it.
 *
 * Ordering and classification (icon/label/href/tone per alert) live in
 * `buildAlertDescriptors` (`@/lib/alerts/alert-descriptors`), shared with the
 * TopBar's `NotificationsPopover` so the two never disagree about what a
 * count means or what color it gets. Rows at zero are dropped rather than
 * shown dimmed — a zero here isn't a lesser version of the same fact, it's
 * the absence of one.
 */
export function OperationsStrip({ alerts }: OperationsStripProps) {
  const active = buildAlertDescriptors(alerts).filter((descriptor) => descriptor.count > 0);

  if (active.length === 0) {
    return (
      <div className="flex flex-col gap-xs rounded-card border border-borde bg-surface p-lg">
        <div className="flex items-center gap-sm text-negro">
          <CheckCircle size={20} weight="regular" aria-hidden="true" />
          <span className="font-ui text-ui">Sin pendientes operativos</span>
        </div>
        <p className="font-body text-caption text-grafito">
          Ventas, pedidos entrantes, stock, autorizaciones, pagos y solicitudes: todo al día.
        </p>
      </div>
    );
  }

  const [featured, ...rest] = active;

  return (
    <div className="flex flex-col gap-md">
      <FeaturedAlert descriptor={featured!} />
      {rest.length > 0 ? (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 xl:grid-cols-4">
          {rest.map((descriptor) => (
            <AlertRow key={descriptor.key} descriptor={descriptor} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FeaturedAlert({ descriptor }: { descriptor: AlertDescriptor }) {
  const IconComponent = descriptor.icon;
  return (
    <Link
      href={descriptor.href}
      className={cn(
        "flex items-center gap-lg rounded-card p-lg transition-colors duration-150",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro hover:brightness-95",
        FEATURED_TONE_CLASSES[descriptor.tone],
      )}
    >
      <IconComponent size={32} weight="regular" aria-hidden="true" className="shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display text-h2">{descriptor.count}</span>
        <span className="font-ui text-ui">{descriptor.label}</span>
      </span>
      <ArrowRight size={20} weight="regular" aria-hidden="true" className="shrink-0" />
    </Link>
  );
}

function AlertRow({ descriptor }: { descriptor: AlertDescriptor }) {
  const IconComponent = descriptor.icon;
  return (
    <Link
      href={descriptor.href}
      className={cn(
        "flex items-center gap-sm rounded-card border border-borde bg-surface p-md transition-colors duration-150",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro hover:bg-inset",
      )}
    >
      <IconComponent
        size={18}
        weight="regular"
        aria-hidden="true"
        className={cn("shrink-0", ROW_TONE_CLASSES[descriptor.tone])}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("font-ui text-ui", ROW_TONE_CLASSES[descriptor.tone])}>{descriptor.count}</span>
        <span className="truncate font-body text-caption text-grafito">{descriptor.label}</span>
      </span>
    </Link>
  );
}
