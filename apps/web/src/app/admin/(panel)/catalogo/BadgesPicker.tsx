"use client";

import type { AdminBadge } from "@bw-bikes/shared";
import { Check } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/lib/cn";

/** Mirrors `MAX_PRODUCT_BADGES` in `apps/api/src/models/bike.model.ts`. */
export const MAX_PRODUCT_BADGES = 1;

/** `ButtonLink` renders `Button`'s `text` variant on an `<a>`, so this no longer hand-copies the variant's classes and can't drift from it. */
function ManageBadgesLink() {
  return (
    <ButtonLink href="/admin/catalogo/badges" variant="text" className="self-start">
      Administrar badges
    </ButtonLink>
  );
}

export interface BadgesPickerProps {
  /** Every active badge — short, fixed list, so it's loaded whole (no search, unlike `RelatedAccessoriesPicker`). */
  available: AdminBadge[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

/** Toggle-able chips, capped at three — merchandising badges stop reading as "highlighted" past that. */
export function BadgesPicker({ available, selected, onChange }: BadgesPickerProps) {
  const atLimit = selected.length >= MAX_PRODUCT_BADGES;

  function toggle(id: string): void {
    if (selected.includes(id)) {
      onChange(selected.filter((selectedId) => selectedId !== id));
      return;
    }
    if (atLimit) return;
    onChange([...selected, id]);
  }

  if (available.length === 0) {
    return (
      <div className="flex flex-col items-start gap-sm">
        <p className="font-body text-caption text-grafito">No hay badges activos todavía.</p>
        <ManageBadgesLink />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      <div role="group" aria-label="Badges del producto" className="flex flex-wrap gap-sm">
        {available.map((badge) => {
          const isSelected = selected.includes(badge.id);
          const disabled = !isSelected && atLimit;
          return (
            <button
              key={badge.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(badge.id)}
              aria-pressed={isSelected}
              className={cn(
                "inline-flex items-center gap-xs rounded-control border p-xs",
                "transition-colors duration-150",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
                isSelected ? "border-negro bg-inset" : "border-borde hover:border-grafito",
                disabled && "cursor-not-allowed opacity-40",
              )}
            >
              {isSelected ? <Check aria-hidden="true" size={14} weight="bold" className="text-negro" /> : null}
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </button>
          );
        })}
      </div>
      {atLimit ? (
        <p className="font-body text-caption text-estado-advertencia">
          Solo se puede asignar {MAX_PRODUCT_BADGES} badge por producto. Deselecciona el actual para cambiarlo.
        </p>
      ) : null}
      <ManageBadgesLink />
    </div>
  );
}
