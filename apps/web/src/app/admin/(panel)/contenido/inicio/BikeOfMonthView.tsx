"use client";

import type { AdminBike, AdminBikeOfMonth, BikeOfMonthInput } from "@bw-bikes/shared";
import { MAX_BIKE_OF_MONTH_EYEBROW_LENGTH, MAX_BIKE_OF_MONTH_SUBTITLE_LENGTH, MAX_BIKE_OF_MONTH_TITLE_LENGTH } from "@bw-bikes/shared";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/use-toast";
import { removeBikeOfMonthImage, updateBikeOfMonth, uploadBikeOfMonthImage } from "@/lib/api/admin-content";
import { ApiError } from "@/lib/api/error";
import { CategoryImageField } from "../../catalogo/categorias/CategoryImageField";
import { EditorSection } from "../../catalogo/EditorSection";

export interface BikeOfMonthViewProps {
  initialBikeOfMonth: AdminBikeOfMonth;
  bikes: AdminBike[];
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * The home's single "bici del mes" banner (M12) — one photo plus text and a
 * catalog reference, no list/reorder like `HomeTilesView` but with a form
 * like a (much simpler) `HeroSlideFormModal`: no modal since there's only
 * ever one record, and no CTA editor at all — "Conocer más"/"Comprar" are
 * hardcoded in the storefront banner, only the bike they both point at is
 * chosen here.
 *
 * `EditorSection` (the catalog editor's card primitive — one visual level up
 * from `bg-base`, DESIGN.md §4) is reused here instead of a bare heading and
 * a flat field stack: five heterogeneous controls (dropzone, two inputs, a
 * textarea, a combobox) plus a save action read as one editable record only
 * inside a bounded surface, the same reasoning `SettingsSectionCard` applies
 * to each settings section.
 */
export function BikeOfMonthView({ initialBikeOfMonth, bikes }: BikeOfMonthViewProps) {
  const { toast } = useToast();
  const [bikeOfMonth, setBikeOfMonth] = useState(initialBikeOfMonth);
  const [eyebrow, setEyebrow] = useState(initialBikeOfMonth.eyebrow ?? "");
  const [title, setTitle] = useState(initialBikeOfMonth.title ?? "");
  const [subtitle, setSubtitle] = useState(initialBikeOfMonth.subtitle ?? "");
  const [bikeId, setBikeId] = useState(initialBikeOfMonth.bikeId ?? "");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const bikeOptions: ComboboxOption[] = bikes.map((bike) => ({ id: bike.id, label: bike.name }));

  async function handleSave(): Promise<void> {
    if (!title.trim()) {
      setTitleError("El título es obligatorio.");
      return;
    }
    setTitleError(undefined);
    setSubmitting(true);
    try {
      const input: BikeOfMonthInput = {
        ...(eyebrow.trim() ? { eyebrow: eyebrow.trim() } : {}),
        title: title.trim(),
        ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
        ...(bikeId ? { bikeId } : {}),
      };
      const saved = await updateBikeOfMonth(input);
      setBikeOfMonth(saved);
      toast({ variant: "success", title: "Cambios guardados" });
    } catch (error) {
      toast({ variant: "error", title: "No se pudo guardar el banner", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadImage(file: File): Promise<void> {
    const saved = await uploadBikeOfMonthImage(file);
    setBikeOfMonth(saved);
  }

  async function handleRemoveImage(): Promise<void> {
    const saved = await removeBikeOfMonthImage();
    setBikeOfMonth(saved);
  }

  return (
    <EditorSection
      id="bike-of-month"
      title="Bici del mes"
      description={
        'El banner de una sola bici destacada, después de las tarjetas de comprar bicis/accesorios — los botones "Conocer más" y "Comprar" ya están fijos en el sitio, solo eliges a qué bici llevan.'
      }
      className="mt-2xl"
    >
      <CategoryImageField mode="immediate" image={bikeOfMonth.image} onUpload={handleUploadImage} onRemove={handleRemoveImage} />

      <Input
        label="Título"
        required
        maxLength={MAX_BIKE_OF_MONTH_TITLE_LENGTH}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={titleError}
      />

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Input
          label="Eyebrow (opcional)"
          placeholder="Nueva temporada"
          maxLength={MAX_BIKE_OF_MONTH_EYEBROW_LENGTH}
          value={eyebrow}
          onChange={(event) => setEyebrow(event.target.value)}
        />
        <Combobox label="Bici destacada" value={bikeId} onChange={setBikeId} options={bikeOptions} />
      </div>

      <Textarea
        label="Subtítulo (opcional)"
        maxLength={MAX_BIKE_OF_MONTH_SUBTITLE_LENGTH}
        value={subtitle}
        onChange={(event) => setSubtitle(event.target.value)}
      />

      {bikeOfMonth.isBroken ? (
        <Badge variant="error">La bici seleccionada ya no existe o está inactiva — revisa el banner</Badge>
      ) : bikeOfMonth.href ? (
        <p className="font-body text-caption text-grafito">Los botones van a: {bikeOfMonth.href}</p>
      ) : null}

      <div>
        <Button variant="primary" loading={submitting} onClick={() => void handleSave()}>
          Guardar cambios
        </Button>
      </div>
    </EditorSection>
  );
}
