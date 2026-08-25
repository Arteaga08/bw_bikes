"use client";

import type { AdminHeroSlide, HeroCtaTargetType, HeroFocalPoint, HeroSlideInput } from "@bw-bikes/shared";
import { HERO_FOCAL_POINTS, MAX_HERO_CTAS_PER_SLIDE, MAX_HERO_EYEBROW_LENGTH, MAX_HERO_SUBTITLE_LENGTH, MAX_HERO_TITLE_LENGTH } from "@bw-bikes/shared";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ComboboxOption } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api/error";
import { CategoryImageField } from "../../catalogo/categorias/CategoryImageField";
import { HeroCtaFields, type HeroCtaValue } from "./HeroCtaFields";

const FOCAL_POINT_LABELS: Record<HeroFocalPoint, string> = {
  left: "Izquierda",
  center: "Centro",
  right: "Derecha",
};

function emptyCta(): HeroCtaValue {
  return { label: "", target: { type: "url", url: "" } };
}

export interface HeroSlideFormModalProps {
  onClose: () => void;
  onCreate: (input: HeroSlideInput) => Promise<AdminHeroSlide>;
  onUpdate: (id: string, input: HeroSlideInput) => Promise<AdminHeroSlide>;
  onUploadImage: (id: string, file: File) => Promise<AdminHeroSlide>;
  onRemoveImage: (id: string) => Promise<AdminHeroSlide>;
  onChanged: () => void;
  /** Present when editing; absent when creating a new slide. */
  initial?: AdminHeroSlide;
  catalogOptionsByType: Record<Exclude<HeroCtaTargetType, "url">, ComboboxOption[]>;
}

/**
 * Create/edit form for one hero slide. Same two-step image flow as
 * `CategoryFormModal`: on create, the photo is staged locally
 * (`CategoryImageField` in `"deferred"` mode) and uploaded right after the
 * first "Guardar" creates the slide — one click for the admin, two requests
 * underneath. `HeroSlide.image` is optional at the API for exactly this
 * reason (`hero-slide.model.ts`); a slide with no image yet just never
 * reaches the public carousel (`hero-slide.service.ts`'s `listPublic`).
 */
export function HeroSlideFormModal({
  onClose,
  onCreate,
  onUpdate,
  onUploadImage,
  onRemoveImage,
  onChanged,
  initial,
  catalogOptionsByType,
}: HeroSlideFormModalProps) {
  const { toast } = useToast();
  const [slide, setSlide] = useState<AdminHeroSlide | undefined>(initial);
  const [focalPoint, setFocalPoint] = useState<HeroFocalPoint>(initial?.focalPoint ?? "center");
  const [eyebrow, setEyebrow] = useState(initial?.eyebrow ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [ctas, setCtas] = useState<HeroCtaValue[]>(
    initial?.ctas.map((cta) => ({ label: cta.label, target: cta.target })) ?? [emptyCta()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | undefined>();

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const pendingPreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    pendingPreviewUrlRef.current = pendingPreviewUrl;
  }, [pendingPreviewUrl]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrlRef.current) URL.revokeObjectURL(pendingPreviewUrlRef.current);
    };
  }, []);

  function handleSelectPendingImage(file: File): void {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  }

  function handleClearPendingImage(): void {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
  }

  function updateCta(index: number, value: HeroCtaValue): void {
    setCtas((current) => current.map((cta, ctaIndex) => (ctaIndex === index ? value : cta)));
  }

  function removeCta(index: number): void {
    setCtas((current) => current.filter((_, ctaIndex) => ctaIndex !== index));
  }

  function addCta(): void {
    setCtas((current) => (current.length >= MAX_HERO_CTAS_PER_SLIDE ? current : [...current, emptyCta()]));
  }

  function buildInput(): HeroSlideInput {
    return {
      focalPoint,
      ...(eyebrow.trim() ? { eyebrow: eyebrow.trim() } : {}),
      title: title.trim(),
      ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
      ctas: ctas.map((cta) => ({
        label: cta.label.trim(),
        target:
          cta.target.type === "url"
            ? { type: "url", url: cta.target.url ?? "" }
            : { type: cta.target.type, refId: cta.target.refId ?? "" },
      })),
      isActive,
    };
  }

  async function handleSubmit(): Promise<void> {
    if (!title.trim()) {
      setTitleError("El título es obligatorio.");
      return;
    }
    setTitleError(undefined);
    setSubmitting(true);
    try {
      const input = buildInput();
      const wasCreate = !slide;
      const saved = slide ? await onUpdate(slide.id, input) : await onCreate(input);
      toast({ variant: "success", title: slide ? "Cambios guardados" : "Slide creado" });
      setSlide(saved);
      onChanged();

      if (wasCreate && pendingFile) {
        const fileToUpload = pendingFile;
        handleClearPendingImage();
        try {
          await onUploadImage(saved.id, fileToUpload);
          onChanged();
        } catch (uploadError) {
          toast({
            variant: "error",
            title: "Se creó el slide, pero no se pudo subir la imagen",
            description:
              uploadError instanceof ApiError ? uploadError.message : "Puedes intentarlo de nuevo desde aquí mismo.",
          });
        }
      }
      onClose();
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo guardar el slide",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadImage(file: File): Promise<void> {
    if (!slide) return;
    const saved = await onUploadImage(slide.id, file);
    setSlide(saved);
    onChanged();
  }

  async function handleRemoveImage(): Promise<void> {
    if (!slide) return;
    const saved = await onRemoveImage(slide.id);
    setSlide(saved);
    onChanged();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={slide ? "Editar slide" : "Nuevo slide"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {slide ? "Cerrar" : "Cancelar"}
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            {slide ? "Guardar cambios" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        {slide?.image ? (
          <CategoryImageField mode="immediate" image={slide.image} onUpload={handleUploadImage} onRemove={handleRemoveImage} />
        ) : (
          <CategoryImageField
            mode="deferred"
            previewUrl={pendingPreviewUrl}
            onSelect={handleSelectPendingImage}
            onClear={handleClearPendingImage}
          />
        )}

        <Input
          label="Título"
          required
          maxLength={MAX_HERO_TITLE_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={titleError}
        />
        <Input
          label="Eyebrow (opcional)"
          placeholder="Edición 2026"
          maxLength={MAX_HERO_EYEBROW_LENGTH}
          value={eyebrow}
          onChange={(event) => setEyebrow(event.target.value)}
        />
        <Textarea
          label="Subtítulo (opcional)"
          maxLength={MAX_HERO_SUBTITLE_LENGTH}
          value={subtitle}
          onChange={(event) => setSubtitle(event.target.value)}
        />
        <Select label="Punto focal" value={focalPoint} onChange={(event) => setFocalPoint(event.target.value as HeroFocalPoint)}>
          {HERO_FOCAL_POINTS.map((point) => (
            <option key={point} value={point}>
              {FOCAL_POINT_LABELS[point]}
            </option>
          ))}
        </Select>
        <Toggle label="Activo" checked={isActive} onChange={setIsActive} />

        <div className="flex flex-col gap-sm">
          {ctas.map((cta, index) => (
            <HeroCtaFields
              key={index}
              value={cta}
              onChange={(value) => updateCta(index, value)}
              resolved={slide?.ctas[index]}
              removeLabel={`Botón ${index + 1}${index === 0 ? " (obligatorio)" : " (opcional)"}`}
              onRemove={index > 0 ? () => removeCta(index) : undefined}
              catalogOptionsByType={catalogOptionsByType}
            />
          ))}
          {ctas.length < MAX_HERO_CTAS_PER_SLIDE ? (
            <Button variant="ghost" onClick={addCta}>
              Agregar un segundo botón
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
