import type { OperationalAlerts } from "@bw-bikes/shared";
import type { Icon } from "@phosphor-icons/react";
import { Bicycle, CaretRight, Handshake, Package } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface QuickLinksProps {
  alerts: OperationalAlerts;
}

interface QuickLinkDescriptor {
  key: string;
  icon: Icon;
  label: string;
  description: string;
  href: string;
  /** `estado-*` urgency dot — omitted when the section has nothing pending right now. Reuses `OperationsStrip`'s own alert counts rather than a second fetch. */
  tone?: "advertencia" | "error";
}

/**
 * Navigation shortcuts to the three sections an admin jumps to most between
 * checking Inicio's numbers and actually doing something about them —
 * reusing the same `alerts` `page.tsx` already fetched for `OperationsStrip`,
 * so a section with something pending gets the same `estado-*` urgency dot
 * that system already uses everywhere else (never a new color, per Manuel:
 * "es un indicador de estado de urgencia, no paleta").
 */
export function QuickLinks({ alerts }: QuickLinksProps) {
  const descriptors: QuickLinkDescriptor[] = [
    { key: "catalogo", icon: Bicycle, label: "Catálogo", description: "Bicicletas y accesorios", href: "/admin/catalogo" },
    {
      key: "inventario",
      icon: Package,
      label: "Inventario",
      description: alerts.outOfStockSkus > 0 ? `${alerts.outOfStockSkus} SKU sin stock` : "Existencias por SKU",
      href: "/admin/inventario",
      tone: alerts.outOfStockSkus > 0 ? "error" : undefined,
    },
    {
      key: "solicitudes",
      icon: Handshake,
      label: "Solicitudes",
      description: alerts.pendingApplications > 0 ? `${alerts.pendingApplications} pendientes` : "Cola de aprobación",
      href: "/admin/solicitudes",
      tone: alerts.pendingApplications > 0 ? "advertencia" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
      {descriptors.map((descriptor) => {
        const IconComponent = descriptor.icon;
        return (
          <Link
            key={descriptor.key}
            href={descriptor.href}
            className={cn(
              "flex items-center gap-md rounded-card border border-borde bg-surface p-lg transition-colors duration-150",
              "hover:bg-inset focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-card bg-inset",
                descriptor.tone === "error" && "text-estado-error",
                descriptor.tone === "advertencia" && "text-estado-advertencia",
                !descriptor.tone && "text-negro",
              )}
            >
              <IconComponent size={20} weight="regular" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-ui text-ui text-negro">{descriptor.label}</span>
              <span className="truncate font-body text-caption text-grafito">{descriptor.description}</span>
            </span>
            <CaretRight size={16} weight="regular" aria-hidden="true" className="shrink-0 text-grafito" />
          </Link>
        );
      })}
    </div>
  );
}
