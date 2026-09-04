"use client";

import type { CategoryImage } from "@bw-bikes/shared";
import { ImagesSquare } from "@phosphor-icons/react";
import Image from "next/image";
import type { ChangeEvent, DragEvent } from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api/error";
import { cn } from "@/lib/cn";

/** Mirrors the formats `image-pipeline.ts` accepts by magic bytes — the `accept` attribute is a UX hint, the real check is server-side. */
const ACCEPTED_MIME_TYPES = "image/jpeg,image/png,image/webp,image/avif";

/**
 * How large the preview frame is, and therefore which of the two layouts the
 * field renders.
 *
 * `compact` is the original: a tall dashed dropzone with a 64px thumbnail
 * floating in the middle of it. It says nothing about framing, which is fine
 * for a brand logo or a geometry chart — those are read at thumbnail size
 * anyway.
 *
 * The ratios are the *real* crops the storefront applies, so the preview
 * stops lying about what the photo will look like: `3/2` is
 * `PhotoCtaTile`'s desktop tile, `16/9` is `PromoBanner`'s banner. Pick the
 * one matching the surface the image lands on, never "whatever looks nice".
 */
export type ImageFieldAspect = "compact" | "3/2" | "16/9";

const FRAME_CLASSES: Record<Exclude<ImageFieldAspect, "compact">, string> = {
  "3/2": "aspect-[3/2]",
  "16/9": "aspect-[16/9]",
};

interface ImageFieldCommonProps {
  /** Replaces the default "Imagen" — a caller that already knows what this photo *is* ("Comprar Bicicletas") shouldn't stack a second, emptier label above it. */
  label?: string;
  labelHidden?: boolean;
  aspect?: ImageFieldAspect;
}

interface ImageFieldImmediateProps extends ImageFieldCommonProps {
  mode: "immediate";
  image?: CategoryImage;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}

interface ImageFieldDeferredProps extends ImageFieldCommonProps {
  mode: "deferred";
  /** Local object URL for the file picked so far — there's no record id yet to upload to. */
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onClear: () => void;
}

export type ImageFieldProps = ImageFieldImmediateProps | ImageFieldDeferredProps;

/**
 * A record that carries at most one image — the single-image sibling of
 * `GallerySection.tsx`'s product gallery: no reorder, no multi-select. Shared
 * by categorías, marcas, the product editor's geometry charts and the three
 * Gestión de Home widgets, which is why it lives in `components/ui` rather
 * than inside whichever feature folder happened to need it first.
 *
 * Two modes:
 * - `immediate`: the record already exists, so selecting a file uploads it
 *   right away — same "hit the endpoint immediately, never batch into the
 *   surrounding form's save" discipline as the product gallery.
 * - `deferred`: the record doesn't exist yet (create flow, before the first
 *   "Guardar"). Selecting a file only stages it locally via `onSelect` — the
 *   caller uploads it right after the record is created, so the admin picks
 *   the image once, up front, instead of saving twice.
 *
 * `aspect` picks between two layouts. `compact` keeps the thumbnail-in-a-
 * dropzone shape; a ratio makes **the photo itself the dropzone**, filling a
 * fixed frame with a permanent bottom scrim carrying the "Cambiar imagen"
 * affordance. The scrim isn't hover-gated on purpose: an affordance hidden
 * behind `:hover` doesn't exist on touch. The bottom-up black gradient is
 * also the storefront's own grammar (`HeroSlideMedia`, `PhotoCtaTile`), so
 * the preview reads like the thing it's previewing.
 */
export function ImageField(props: ImageFieldProps) {
  const { label = "Imagen", labelHidden = false, aspect = "compact" } = props;
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function processFile(file: File): Promise<void> {
    if (props.mode === "deferred") {
      props.onSelect(file);
      return;
    }

    setBusy(true);
    try {
      await props.onUpload(file);
      toast({ variant: "success", title: "Imagen actualizada" });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo subir la imagen",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>): Promise<void> {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
    const file = event.dataTransfer.files[0];
    if (file) await processFile(file);
  }

  async function handleRemove(): Promise<void> {
    if (props.mode === "deferred") {
      props.onClear();
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    try {
      await props.onRemove();
      toast({ variant: "success", title: "Imagen eliminada" });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo eliminar la imagen",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setBusy(false);
    }
  }

  const hasPreview = props.mode === "deferred" ? props.previewUrl !== null : props.image !== undefined;
  const previewUrl = props.mode === "deferred" ? props.previewUrl : props.image?.url;
  const previewAlt = props.mode === "deferred" ? "" : (props.image?.alt ?? "");
  const framed = aspect !== "compact";

  // Every drag handler is identical between the two layouts — only the frame
  // classes and what goes inside it change.
  const dropzoneHandlers = {
    onDragEnter: (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      if (!busy) setDragOver(true);
    },
    onDragOver: (event: DragEvent<HTMLLabelElement>) => event.preventDefault(),
    onDragLeave: () => setDragOver(false),
    onDrop: (event: DragEvent<HTMLLabelElement>) => void handleDrop(event),
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_MIME_TYPES}
      disabled={busy}
      onChange={(event) => void handleFileSelected(event)}
      aria-label={hasPreview ? `Reemplazar ${label.toLowerCase()}` : `Subir ${label.toLowerCase()}`}
      className="sr-only"
    />
  );

  const emptyHint = (
    <>
      <ImagesSquare aria-hidden="true" size={28} className="text-grafito" />
      <p className="font-ui text-ui text-negro">Arrastra una imagen aquí o elige un archivo</p>
      <p className="font-body text-caption text-grafito">JPG, PNG, WebP o AVIF</p>
    </>
  );

  return (
    <div className="flex flex-col gap-sm">
      <span className={cn("font-ui text-ui text-negro", labelHidden && "sr-only")}>{label}</span>

      {framed ? (
        <label
          className={cn(
            "relative block w-full overflow-hidden rounded-card border transition-colors duration-150",
            FRAME_CLASSES[aspect],
            hasPreview ? "border-borde bg-inset" : "border-dashed",
            !hasPreview && (dragOver ? "border-negro bg-surface" : "border-borde bg-inset"),
            hasPreview && dragOver && "border-negro",
            busy ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          )}
          {...dropzoneHandlers}
        >
          {fileInput}
          {hasPreview ? (
            <>
              {props.mode === "deferred" ? (
                // Local blob: URL from a file the admin just picked — next/image can't optimize a client-only object URL.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl ?? undefined} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <Image src={previewUrl ?? ""} alt={previewAlt} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
              )}
              <span className="absolute inset-x-0 bottom-0 flex flex-wrap items-baseline gap-x-sm gap-y-0 bg-gradient-to-t from-negro/80 to-transparent px-md pb-md pt-xl">
                <span className="font-ui text-ui text-blanco">Cambiar imagen</span>
                <span className="font-body text-caption text-blanco/70">JPG, PNG, WebP o AVIF</span>
              </span>
            </>
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-xs px-md text-center">{emptyHint}</span>
          )}
        </label>
      ) : (
        <label
          className={cn(
            "flex flex-col items-center gap-xs rounded-card border border-dashed p-lg text-center transition-colors duration-150",
            dragOver ? "border-negro bg-surface" : "border-borde bg-inset",
            busy ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          )}
          {...dropzoneHandlers}
        >
          {fileInput}
          {hasPreview ? (
            <>
              {props.mode === "deferred" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl ?? undefined} alt="" className="h-16 w-16 rounded-control object-cover" />
              ) : (
                <Image
                  src={previewUrl ?? ""}
                  alt={previewAlt}
                  width={props.image?.width ?? 64}
                  height={props.image?.height ?? 64}
                  className="h-16 w-16 rounded-control object-cover"
                />
              )}
              <p className="font-ui text-ui text-negro">Cambiar imagen</p>
              <p className="font-body text-caption text-grafito">JPG, PNG, WebP o AVIF</p>
            </>
          ) : (
            emptyHint
          )}
        </label>
      )}

      {hasPreview ? (
        <Button variant="ghost" className="self-start" disabled={busy} onClick={() => void handleRemove()}>
          {props.mode === "deferred" ? "Quitar" : "Eliminar"}
        </Button>
      ) : null}
    </div>
  );
}
