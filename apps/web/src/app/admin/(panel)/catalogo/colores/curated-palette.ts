export interface CuratedColor {
  name: string;
  hex: string;
}

/** Acabados típicos de bicicletas y accesorios, para elegir un hex con un clic sin que el admin necesite conocer el código. */
export const CURATED_COLOR_PALETTE: CuratedColor[] = [
  { name: "Negro", hex: "#0A0A0A" },
  { name: "Negro mate", hex: "#1C1C1C" },
  { name: "Blanco", hex: "#FFFFFF" },
  { name: "Gris", hex: "#808080" },
  { name: "Plata", hex: "#C0C0C0" },
  { name: "Titanio", hex: "#878681" },
  { name: "Rojo", hex: "#D0021B" },
  { name: "Azul", hex: "#0057B8" },
  { name: "Azul marino", hex: "#1B2A4A" },
  { name: "Verde", hex: "#2E7D32" },
  { name: "Verde militar", hex: "#4B5320" },
  { name: "Amarillo", hex: "#F5D000" },
  { name: "Naranja", hex: "#F57C00" },
  { name: "Café", hex: "#6F4E37" },
  { name: "Dorado", hex: "#C9A22A" },
  { name: "Rosa", hex: "#E91E8C" },
  { name: "Morado", hex: "#7B2FBE" },
];
