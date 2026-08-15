import type { PdpDiagramZone } from "./PdpDiagram";

export interface HelpTopic {
  /** Names the `HelpPopover` trigger and its dialog title. */
  label: string;
  /** A couple of lines, always answering the same question: where does this show up? */
  text: string;
}

/** One entry per `PdpDiagramZone` — the copy `ProductEditor` pairs with `<PdpDiagram highlight={zone} />` inside each section's `HelpPopover`. */
export const HELP_CONTENT: Record<PdpDiagramZone, HelpTopic> = {
  descripcionCorta: {
    label: "Descripción corta",
    text: "Se muestra bajo el nombre en las tarjetas del catálogo — lo primero que lee el cliente, antes de abrir la ficha del producto.",
  },
  galeria: {
    label: "Galería",
    text: "Las fotos del producto en su ficha pública. La primera imagen de la lista es la portada que se ve en el catálogo.",
  },
  resumen: {
    label: "Resumen",
    text: "Los datos esenciales, junto a la descripción principal — antes de que el cliente baje hasta la ficha técnica completa.",
  },
  descripcion: {
    label: "Descripción",
    text: "El texto principal de la ficha pública, debajo del título y el precio.",
  },
  fichaTecnica: {
    label: "Ficha técnica",
    text: "Los apartados con sus especificaciones, más abajo en la ficha — cada uno con su propio título y lista de etiqueta/valor.",
  },
  geometria: {
    label: "Geometría",
    text: "El diagrama de geometría de la bicicleta, dentro de la ficha técnica. Solo aplica a bicicletas.",
  },
  accesorios: {
    label: "Accesorios sugeridos",
    text: "El cross-sell «Quizás también te interese», al final de la ficha de la bicicleta.",
  },
};
