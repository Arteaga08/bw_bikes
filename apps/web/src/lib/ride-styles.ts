import type { RideStyle } from "./size-recommendation";

export interface RideStyleOption {
  value: RideStyle;
  label: string;
  description: string;
}

/** Shared by `SizeGuideModal` (the PDP's "¿Cuál es mi talla?" wizard) and `FitForm` (`/mi-cuenta/mis-tallas`) — same three choices, one source. */
export const RIDE_STYLES: RideStyleOption[] = [
  {
    value: "comfortable",
    label: "Cómodo",
    description: "Recorridos largos con la mayor comodidad posible. Postura erguida, menos tensión.",
  },
  {
    value: "balanced",
    label: "Equilibrado",
    description: "Un punto medio entre comodidad y rendimiento — sirve tanto para trayectos cortos como largos.",
  },
  {
    value: "performance",
    label: "Deportivo",
    description: "Velocidad y rendimiento máximos, para rutas exigentes.",
  },
];
