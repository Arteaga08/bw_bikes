"use client";

import { Textarea } from "@/components/ui/Textarea";
import { PRODUCT_FIELD_IDS } from "./field-ids";

export interface BikeBasicsValue {
  shortDescription: string;
}

export interface BikeBasicsFieldsProps {
  value: BikeBasicsValue;
  onChange: (value: BikeBasicsValue) => void;
  errors?: Partial<Record<keyof BikeBasicsValue, string>>;
}

/** The bike-only field (plus cross-sell in its own picker) — accessories don't have it. */
export function BikeBasicsFields({ value, onChange, errors = {} }: BikeBasicsFieldsProps) {
  return (
    <Textarea
      id={PRODUCT_FIELD_IDS.shortDescription}
      label="Descripción corta"
      required
      placeholder="p. ej. Rodamiento ágil para asfalto, ideal para rutas largas."
      helper="Se usa en tarjetas y listados del storefront."
      value={value.shortDescription}
      onChange={(event) => onChange({ ...value, shortDescription: event.target.value })}
      error={errors.shortDescription}
    />
  );
}
