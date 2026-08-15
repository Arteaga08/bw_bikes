import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The seven zones this diagram can highlight — one per help topic in
 * `help-content.ts`. `descripcionCorta` lives on the listing card, not the
 * product page itself; the other six live on the page (M12).
 */
export type PdpDiagramZone =
  | "descripcionCorta"
  | "galeria"
  | "resumen"
  | "descripcion"
  | "fichaTecnica"
  | "geometria"
  | "accesorios";

export interface PdpDiagramProps {
  /** The zone this instance calls out — every other zone still renders, just unhighlighted, so the admin always sees the whole picture. */
  highlight: PdpDiagramZone;
  className?: string;
}

interface ZoneBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  active: boolean;
  children?: ReactNode;
}

/** A highlightable region: its own border/fill when `active`, otherwise the same muted wireframe treatment as the diagram's non-interactive placeholders. */
function ZoneBox({ x, y, width, height, label, active, children }: ZoneBoxProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        strokeWidth={active ? 2 : 1}
        className={active ? "fill-dorado/15 stroke-dorado" : "fill-inset stroke-borde"}
      />
      <text x={x + 8} y={y + 16} fontSize={11} className={cn("font-ui", active ? "fill-negro" : "fill-grafito")}>
        {label}
      </text>
      {children}
    </g>
  );
}

/** A plain greeked line — a stand-in for real text/images inside a zone or a non-interactive area, never itself clickable. */
function Placeholder({ x, y, width, height = 8, rx = 2 }: { x: number; y: number; width: number; height?: number; rx?: number }) {
  return <rect x={x} y={y} width={width} height={height} rx={rx} className="fill-borde" />;
}

/**
 * A schematic of the future public product page — inline SVG, no diagramming
 * library (the project has none). Reused seven times, once per
 * `HelpPopover`, with only the `highlight` prop changing which zone reads as
 * "you are here". Coordinates are hand-picked to roughly match a real
 * card-plus-PDP layout, not derived from any actual page — see the note at
 * the bottom of this file.
 */
export function PdpDiagram({ highlight, className }: PdpDiagramProps) {
  return (
    <svg viewBox="0 0 400 870" role="img" aria-label="Esquema de la ficha pública de producto" className={cn("w-full", className)}>
      {/* Listing card — the grid the storefront's catalog shows, one card per product. */}
      <rect x={16} y={16} width={160} height={150} rx={8} className="fill-surface stroke-borde" />
      <Placeholder x={24} y={24} width={144} height={84} rx={4} />
      <Placeholder x={24} y={116} width={100} />
      <ZoneBox x={24} y={130} width={144} height={28} label="" active={highlight === "descripcionCorta"}>
        <Placeholder x={32} y={140} width={128} height={6} />
        <Placeholder x={32} y={150} width={96} height={6} />
      </ZoneBox>
      <text x={16} y={184} fontSize={11} className="font-ui fill-grafito">
        Tarjeta de listado
      </text>

      {/* Product page — everything below is the ficha pública itself (M12, not built yet). */}
      <text x={16} y={218} fontSize={12} className="font-ui fill-grafito">
        Ficha de producto (M12)
      </text>

      <ZoneBox x={16} y={228} width={160} height={176} label="Galería" active={highlight === "galeria"}>
        <Placeholder x={24} y={252} width={144} height={120} rx={4} />
        <Placeholder x={24} y={380} width={32} />
        <Placeholder x={62} y={380} width={32} />
        <Placeholder x={100} y={380} width={32} />
        <Placeholder x={138} y={380} width={32} />
      </ZoneBox>

      {/* Title/brand/price sit next to the gallery but aren't a help topic — Manuel called them "evidentes". */}
      <Placeholder x={192} y={228} width={140} height={10} />
      <Placeholder x={192} y={244} width={90} />
      <Placeholder x={192} y={262} width={70} height={12} />

      <ZoneBox x={192} y={284} width={192} height={64} label="Resumen" active={highlight === "resumen"}>
        <Placeholder x={200} y={306} width={8} height={8} rx={2} />
        <Placeholder x={214} y={306} width={150} height={8} />
        <Placeholder x={200} y={322} width={8} height={8} rx={2} />
        <Placeholder x={214} y={322} width={140} height={8} />
        <Placeholder x={200} y={338} width={8} height={8} rx={2} />
        <Placeholder x={214} y={338} width={120} height={8} />
      </ZoneBox>

      <ZoneBox
        x={192}
        y={360}
        width={192}
        height={90}
        label="Descripción"
        active={highlight === "descripcion"}
      >
        <Placeholder x={200} y={382} width={168} />
        <Placeholder x={200} y={398} width={160} />
        <Placeholder x={200} y={414} width={150} />
        <Placeholder x={200} y={430} width={110} />
      </ZoneBox>

      <ZoneBox
        x={16}
        y={474}
        width={368}
        height={112}
        label="Ficha técnica"
        active={highlight === "fichaTecnica"}
      >
        <Placeholder x={28} y={498} width={80} />
        <Placeholder x={140} y={498} width={220} />
        <Placeholder x={28} y={520} width={80} />
        <Placeholder x={140} y={520} width={220} />
        <Placeholder x={28} y={542} width={80} />
        <Placeholder x={140} y={542} width={220} />
        <Placeholder x={28} y={564} width={80} />
        <Placeholder x={140} y={564} width={220} />
      </ZoneBox>

      <ZoneBox
        x={16}
        y={610}
        width={368}
        height={110}
        label="Geometría (solo bicicletas)"
        active={highlight === "geometria"}
      >
        {/* A stylized frame, not a technical drawing — two wheels plus a handful of tubes is enough to read as "bike diagram". */}
        <circle cx={140} cy={678} r={20} className="fill-none stroke-borde" strokeWidth={2} />
        <circle cx={280} cy={678} r={20} className="fill-none stroke-borde" strokeWidth={2} />
        <polyline
          points="140,678 190,625 250,625 280,678 190,625 190,678"
          className="fill-none stroke-borde"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </ZoneBox>

      <ZoneBox
        x={16}
        y={744}
        width={368}
        height={110}
        label="Accesorios sugeridos"
        active={highlight === "accesorios"}
      >
        <Placeholder x={28} y={766} width={104} height={70} rx={4} />
        <Placeholder x={146} y={766} width={104} height={70} rx={4} />
        <Placeholder x={264} y={766} width={104} height={70} rx={4} />
      </ZoneBox>
    </svg>
  );
}

/**
 * NOTA PARA M12: este diagrama describe una ficha pública que todavía no
 * existe (`docs/MILESTONES.md`) — es una promesa de diseño, no una captura.
 * Al construir el catálogo público hay que volver aquí y corregir las
 * coordenadas si el layout real termina siendo distinto.
 */
