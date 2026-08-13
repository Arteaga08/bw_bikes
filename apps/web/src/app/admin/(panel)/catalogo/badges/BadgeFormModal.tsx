"use client";

import type { AdminBadge, BadgeVariant } from "@bw-bikes/shared";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import { adminBadgesApi, type BadgeInput } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { slugify } from "@/lib/catalog/slugify";

export interface BadgeFormModalProps {
  onClose: () => void;
  onSaved: () => void;
  initial?: AdminBadge;
}

const VARIANT_OPTIONS: Array<{ value: BadgeVariant; label: string }> = [
  { value: "accent", label: "Acento (dorado) — Novedad, destacado" },
  { value: "exito", label: "Éxito — Bestseller, disponible" },
  { value: "advertencia", label: "Advertencia — Últimas piezas" },
  { value: "error", label: "Error — Descontinuado" },
  { value: "unavailable", label: "No disponible — Agotado" },
  { value: "neutral", label: "Neutral" },
];

/**
 * Create/edit form for a badge. No image field — a badge is a label plus a
 * pointer into the design system's closed `BadgeVariant` set (never a free
 * hex), so unlike `BrandFormModal`/`CategoryFormModal` there's nothing
 * deferred: a single "Guardar" is a single request.
 */
export function BadgeFormModal({ onClose, onSaved, initial }: BadgeFormModalProps) {
  const { toast } = useToast();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [slug] = useState(initial?.slug ?? "");
  const slugPreview = slug || slugify(label);
  const [variant, setVariant] = useState<BadgeVariant | "">(initial?.variant ?? "");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ label?: string; variant?: string }>({});

  async function handleSubmit(): Promise<void> {
    const nextErrors: { label?: string; variant?: string } = {};
    if (!label.trim()) nextErrors.label = "La etiqueta es obligatoria.";
    if (!variant) nextErrors.variant = "Selecciona una variante.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !variant) return;

    setSubmitting(true);
    try {
      const input: BadgeInput = {
        label: label.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        variant,
        order: Number.parseInt(order, 10) || 0,
        isActive,
      };
      if (initial) await adminBadgesApi.update(initial.id, input);
      else await adminBadgesApi.create(input);
      toast({ variant: "success", title: initial ? "Cambios guardados" : "Badge creado" });
      onSaved();
      onClose();
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo guardar el badge",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Editar badge" : "Nuevo badge"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <Input
          label="Etiqueta"
          required
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          error={errors.label}
        />
        <Input label="Slug" helper="Se genera automáticamente de la etiqueta." value={slugPreview} disabled readOnly />

        <Select
          label="Variante"
          required
          value={variant}
          onChange={(event) => setVariant(event.target.value as BadgeVariant)}
          error={errors.variant}
        >
          <option value="">Selecciona una variante</option>
          {VARIANT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {variant ? (
          <div className="flex items-center gap-sm">
            <span className="font-body text-caption text-grafito">Vista previa:</span>
            <Badge variant={variant}>{label.trim() || "Etiqueta"}</Badge>
          </div>
        ) : null}

        <Input label="Orden" type="number" min={0} value={order} onChange={(event) => setOrder(event.target.value)} />
        <Toggle label="Activo" checked={isActive} onChange={setIsActive} />
      </div>
    </Modal>
  );
}
