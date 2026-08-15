"use client";

import { Textarea } from "@/components/ui/Textarea";
import { PRODUCT_FIELD_IDS } from "./field-ids";
import { SectionHelp } from "./SectionHelp";

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
    <div className="flex flex-col gap-xs">
      <div className="flex items-center gap-xs">
        {/* A `<span>`, not a second `<label htmlFor>` — the `Textarea` below already carries the real (visually hidden) label via `labelHidden`; a second label targeting the same id would concatenate into the accessible name instead of replacing it. */}
        <span className="font-ui text-ui text-negro">Descripción corta</span>
        <SectionHelp zone="descripcionCorta" />
      </div>
      <Textarea
        id={PRODUCT_FIELD_IDS.shortDescription}
        label="Descripción corta"
        labelHidden
        required
        placeholder="p. ej. Rodamiento ágil para asfalto, ideal para rutas largas."
        helper="Se usa en tarjetas y listados del storefront."
        value={value.shortDescription}
        onChange={(event) => onChange({ ...value, shortDescription: event.target.value })}
        error={errors.shortDescription}
      />
    </div>
  );
}
