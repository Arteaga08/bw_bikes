/**
 * Fiscal data for a future CFDI invoice (design-spec open decision #3).
 * **Captured, not timbrado**: M7 does not integrate a PAC (Facturama, SW
 * Sapien, or otherwise) — that is a real milestone of its own, with
 * cancellation, XML/PDF storage and credit notes on refund. What M7 does is
 * capture the data now, on the cart (same pattern as `ShippingAddress` in
 * M6), so a future invoicing milestone never has to backfill historical
 * orders that were placed before it existed.
 *
 * Every field is optional at the type level: an order is perfectly valid
 * with none of them. `postalCode` doubles the shipping address's own — kept
 * separate because CFDI requires the *fiscal* postal code, which for many
 * customers is not where the package ships.
 */
export interface BillingInfo {
  /** 12 chars for a moral person, 13 for a physical one. */
  rfc: string;
  legalName: string;
  cfdiUse: CfdiUse;
  taxRegime: TaxRegime;
  postalCode: string;
}

/** SAT's "Uso de CFDI" catalog, the subset relevant to a retail shop — not the full ~40-entry list. */
export const CFDI_USES = [
  "G01", // Adquisición de mercancías
  "G03", // Gastos en general
  "P01", // Por definir
] as const;

export type CfdiUse = (typeof CFDI_USES)[number];

/** Spanish descriptions for `CFDI_USES`, for any UI that must show the customer a label instead of the raw SAT code. */
export const CFDI_USE_LABELS: Record<CfdiUse, string> = {
  G01: "Adquisición de mercancías",
  G03: "Gastos en general",
  P01: "Por definir",
};

/** SAT's "Régimen fiscal" catalog, the subset a retail customer (physical or moral) is likely to hold. */
export const TAX_REGIMES = [
  "601", // General de Ley Personas Morales
  "603", // Personas Morales con Fines no Lucrativos
  "605", // Sueldos y Salarios e Ingresos Asimilados a Salarios
  "612", // Personas Físicas con Actividades Empresariales y Profesionales
  "621", // Incorporación Fiscal
  "626", // Régimen Simplificado de Confianza
] as const;

export type TaxRegime = (typeof TAX_REGIMES)[number];

/** Spanish descriptions for `TAX_REGIMES`, for any UI that must show the customer a label instead of the raw SAT code. */
export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  "601": "General de Ley Personas Morales",
  "603": "Personas Morales con Fines no Lucrativos",
  "605": "Sueldos y Salarios e Ingresos Asimilados a Salarios",
  "612": "Personas Físicas con Actividades Empresariales y Profesionales",
  "621": "Incorporación Fiscal",
  "626": "Régimen Simplificado de Confianza",
};
