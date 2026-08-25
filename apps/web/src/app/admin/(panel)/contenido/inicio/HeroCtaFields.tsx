"use client";

import type { AdminHeroSlideCta, HeroCtaTargetType, HeroSlideInput } from "@bw-bikes/shared";
import { HERO_CTA_TARGET_TYPES, MAX_HERO_CTA_LABEL_LENGTH } from "@bw-bikes/shared";
import { Trash } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type HeroCtaValue = HeroSlideInput["ctas"][number];

const TARGET_TYPE_LABELS: Record<HeroCtaTargetType, string> = {
  bike: "Bici",
  bikeCategory: "Categoría de bicis",
  accessory: "Accesorio",
  accessoryCategory: "Categoría de accesorios",
  url: "URL libre",
};

export interface HeroCtaFieldsProps {
  value: HeroCtaValue;
  onChange: (value: HeroCtaValue) => void;
  /** Present only when editing an existing slide — surfaces the API's resolved `href`/`isBroken` for this exact CTA. */
  resolved?: AdminHeroSlideCta;
  onRemove?: () => void;
  removeLabel: string;
  catalogOptionsByType: Record<Exclude<HeroCtaTargetType, "url">, ComboboxOption[]>;
}

/**
 * One CTA's fields: label, target type, and either a `Combobox` search
 * against the matching catalog list or a free internal-path `Input` for
 * `"url"`. Mirrors the shape `heroCtaTargetSchema`
 * (`apps/api/src/validators/content.validator.ts`) validates — exactly one
 * of `refId`/`url`, decided by `type`.
 */
export function HeroCtaFields({ value, onChange, resolved, onRemove, removeLabel, catalogOptionsByType }: HeroCtaFieldsProps) {
  function setType(type: HeroCtaTargetType): void {
    onChange({ ...value, target: { type } });
  }

  function setRefId(refId: string): void {
    onChange({ ...value, target: { type: value.target.type, refId } });
  }

  function setUrl(url: string): void {
    onChange({ ...value, target: { type: value.target.type, url } });
  }

  const isCatalogTarget = value.target.type !== "url";

  return (
    <div className="flex flex-col gap-sm rounded-control border border-borde p-md">
      <div className="flex items-center justify-between gap-sm">
        <p className="font-ui text-ui text-negro">{removeLabel}</p>
        {onRemove ? (
          <Button variant="bare" tone="danger" size="sm" iconLeft={<Trash />} onClick={onRemove}>
            Quitar
          </Button>
        ) : null}
      </div>

      <Input
        label="Texto del botón"
        required
        maxLength={MAX_HERO_CTA_LABEL_LENGTH}
        value={value.label}
        onChange={(event) => onChange({ ...value, label: event.target.value })}
      />

      <Select
        label="Destino"
        value={value.target.type}
        onChange={(event) => setType(event.target.value as HeroCtaTargetType)}
      >
        {HERO_CTA_TARGET_TYPES.map((type) => (
          <option key={type} value={type}>
            {TARGET_TYPE_LABELS[type]}
          </option>
        ))}
      </Select>

      {isCatalogTarget ? (
        <Combobox
          label={TARGET_TYPE_LABELS[value.target.type as Exclude<HeroCtaTargetType, "url">]}
          value={value.target.refId ?? ""}
          onChange={setRefId}
          options={catalogOptionsByType[value.target.type as Exclude<HeroCtaTargetType, "url">]}
        />
      ) : (
        <Input
          label="Ruta interna"
          placeholder="/bicicletas"
          value={value.target.url ?? ""}
          onChange={(event) => setUrl(event.target.value)}
          helper={'Debe empezar con "/" — no se aceptan enlaces externos.'}
        />
      )}

      {resolved ? (
        resolved.isBroken ? (
          <Badge variant="error">Destino roto — revisa este botón</Badge>
        ) : resolved.href ? (
          <p className="font-body text-caption text-grafito">Va a: {resolved.href}</p>
        ) : null
      ) : null}
    </div>
  );
}
