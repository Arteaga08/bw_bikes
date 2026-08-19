"use client";

import type { ProductImage } from "@bw-bikes/shared";
import { CaretLeft, CaretRight, DotsSixVertical, ImagesSquare, Trash } from "@phosphor-icons/react";
import Image from "next/image";
import type { ChangeEvent, DragEvent } from "react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api/error";
import { moveImage } from "@/lib/catalog/gallery";
import { cn } from "@/lib/cn";

/** Mirrors `MAX_GALLERY_IMAGES` in `apps/api/src/models/schemas/product-image.schema.ts`. */
export const MAX_GALLERY_IMAGES = 15;

/** Mirrors `MAX_FILE_SIZE_BYTES` in `apps/api/src/middlewares/upload-images.ts`. */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Mirrors the formats `image-pipeline.ts` accepts by magic bytes — the `accept` attribute is a UX hint, the real check is server-side. */
const ACCEPTED_MIME_TYPES = "image/jpeg,image/png,image/webp,image/avif";

/** Mirrors `MAX_IMAGES_PER_COLOR` in `apps/api/src/services/product.service.ts` — checked here too so a blocked 3rd tag never round-trips to the server. */
const MAX_IMAGES_PER_COLOR = 2;

/** A file staged in `deferred` mode — its own id (not the `File`'s identity) so reordering and removal can key off something stable across re-renders. */
export interface StagedGalleryFile {
  id: string;
  file: File;
  previewUrl: string;
}

function stageFile(file: File): StagedGalleryFile {
  return { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) };
}

/** Same shape as `moveImage` (`lib/catalog/gallery.ts`), one type over: a target index, clamped rather than rejected, so both the pointer drag and the arrow buttons share one call. Kept local instead of genericizing `moveImage` — `SpecTemplateFormModal.tsx`'s `moveField` sets the precedent of one small copy per data shape rather than a shared generic. */
function moveStagedFile(staged: StagedGalleryFile[], from: number, to: number): StagedGalleryFile[] {
  const clampedTo = Math.min(Math.max(to, 0), staged.length - 1);
  if (from === clampedTo) return staged;
  const next = [...staged];
  const [moved] = next.splice(from, 1);
  next.splice(clampedTo, 0, moved as StagedGalleryFile);
  return next;
}

/** Splits a drop/pick into what's actually uploadable and what got turned away, so the admin sees exactly why (not a silent partial upload). */
function partitionUploadable(files: File[], remainingSlots: number): { accepted: File[]; rejectedNames: string[] } {
  const accepted: File[] = [];
  const rejectedNames: string[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES || accepted.length >= remainingSlots) {
      rejectedNames.push(file.name);
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejectedNames };
}

interface GallerySectionImmediateProps {
  mode: "immediate";
  gallery: ProductImage[];
  onChange: (gallery: ProductImage[]) => void;
  onUpload: (files: File[]) => Promise<ProductImage[]>;
  onRemove: (publicId: string) => Promise<ProductImage[]>;
  onReorder: (publicIds: string[]) => Promise<ProductImage[]>;
  /**
   * Distinct colors currently typed into the product's variants (`ProductEditor`
   * derives this from `variants`, first-appearance order) — offered as the
   * color-tag options per photo. Prep for a future public gallery-by-color
   * swap; nothing reads the tag yet. Omitted (with `onColorChange`) on a
   * product that doesn't exist yet (`mode: "deferred"` never gets these) —
   * there's no `publicId` to tag against until the first upload.
   */
  availableColors?: string[];
  onColorChange?: (publicId: string, color: string | undefined) => Promise<ProductImage[]>;
}

interface GallerySectionDeferredProps {
  mode: "deferred";
  /** Files staged so far, in order — there's no product id yet to upload to. `ProductEditor` uploads them right after the product is created. */
  staged: StagedGalleryFile[];
  onChange: (staged: StagedGalleryFile[]) => void;
}

export type GallerySectionProps = GallerySectionImmediateProps | GallerySectionDeferredProps;

/** A local card shape both modes render through the same grid — `isLocal` picks `<img>` (a blob URL `next/image` can't optimize) over `<Image>`. */
interface GalleryCard {
  key: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  isLocal: boolean;
  color?: string;
}

function cardsFor(props: GallerySectionProps): GalleryCard[] {
  if (props.mode === "deferred") {
    return props.staged.map((item) => ({ key: item.id, src: item.previewUrl, alt: "", isLocal: true }));
  }
  return props.gallery.map((image) => ({
    key: image.publicId,
    src: image.url,
    alt: image.alt ?? "",
    width: image.width,
    height: image.height,
    isLocal: false,
    color: image.color,
  }));
}

/**
 * Two modes, same discriminated shape as `CategoryImageFieldProps`:
 *
 * - `immediate` (the product exists): every action hits its own endpoint
 *   right away and refreshes from the response — the gallery is never part
 *   of the surrounding form's save, same discipline as this resource's
 *   backend routes (`POST`/`DELETE`/`PATCH .../gallery*`), which never touch
 *   the rest of the product document.
 * - `deferred` (`create`, before the first save): the same dropzone and
 *   grid, but drops just stage the files locally via `URL.createObjectURL`
 *   — reorderable and removable in place, uploaded for real once the
 *   product exists (`ProductEditor.persistPendingGallery`).
 */
export function GallerySection(props: GallerySectionProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const cards = cardsFor(props);
  const atCapacity = cards.length >= MAX_GALLERY_IMAGES;

  async function processFiles(files: File[]): Promise<void> {
    if (files.length === 0 || busy || atCapacity) return;

    const { accepted, rejectedNames } = partitionUploadable(files, MAX_GALLERY_IMAGES - cards.length);
    if (rejectedNames.length > 0) {
      toast({
        variant: "warning",
        title: rejectedNames.length === 1 ? "Una imagen no se pudo agregar" : "Algunas imágenes no se pudieron agregar",
        description: `${rejectedNames.join(", ")} — revisa que pese menos de 5 MB y que haya cupo disponible.`,
      });
    }
    if (accepted.length === 0) return;

    if (props.mode === "deferred") {
      props.onChange([...props.staged, ...accepted.map(stageFile)]);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    try {
      props.onChange(await props.onUpload(accepted));
      toast({ variant: "success", title: "Imágenes agregadas" });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudieron subir las imágenes",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    await processFiles(event.target.files ? Array.from(event.target.files) : []);
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>): Promise<void> {
    event.preventDefault();
    setDragOver(false);
    await processFiles(Array.from(event.dataTransfer.files));
  }

  async function handleRemoveCard(key: string): Promise<void> {
    if (props.mode === "deferred") {
      const target = props.staged.find((item) => item.id === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      props.onChange(props.staged.filter((item) => item.id !== key));
      return;
    }

    setBusy(true);
    try {
      props.onChange(await props.onRemove(key));
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

  /** The one place a reorder is actually persisted (or, in `deferred`, just applied locally) — shared by the keyboard-reachable arrow buttons and drag-and-drop. */
  async function commitMove(from: number, to: number): Promise<void> {
    if (props.mode === "deferred") {
      const reordered = moveStagedFile(props.staged, from, to);
      if (reordered !== props.staged) props.onChange(reordered);
      return;
    }

    const reordered = moveImage(props.gallery, from, to);
    if (reordered === props.gallery) return;

    setBusy(true);
    try {
      props.onChange(await props.onReorder(reordered.map((image) => image.publicId)));
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo reordenar la galería",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleColorChange(publicId: string, color: string): Promise<void> {
    if (props.mode !== "immediate" || !props.onColorChange) return;

    if (color) {
      const existingCount = cards.filter((card) => card.color === color && card.key !== publicId).length;
      if (existingCount >= MAX_IMAGES_PER_COLOR) {
        toast({
          variant: "error",
          title: "No se pudo actualizar el color",
          description: `El color "${color}" ya tiene ${MAX_IMAGES_PER_COLOR} fotos. Quita una antes de agregar otra.`,
        });
        return;
      }
    }

    setBusy(true);
    try {
      props.onChange(await props.onColorChange(publicId, color || undefined));
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo actualizar el color",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleCardDrop(index: number) {
    return (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropTargetIndex(null);
      if (draggedIndex !== null && draggedIndex !== index) void commitMove(draggedIndex, index);
      setDraggedIndex(null);
    };
  }

  return (
    <div className="flex flex-col gap-md">
      <label
        className={cn(
          "flex flex-col items-center gap-xs rounded-card border border-dashed p-lg text-center transition-colors duration-150",
          dragOver ? "border-negro bg-surface" : "border-borde bg-inset",
          busy || atCapacity ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy && !atCapacity) setDragOver(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => void handleDrop(event)}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES}
          multiple
          disabled={busy || atCapacity}
          onChange={(event) => void handleFilesSelected(event)}
          aria-label="Subir imágenes"
          className="sr-only"
        />
        {busy ? (
          <span
            aria-hidden="true"
            className="h-7 w-7 animate-spin rounded-full border-2 border-negro border-t-transparent"
          />
        ) : (
          <ImagesSquare aria-hidden="true" size={28} className="text-grafito" />
        )}
        <p className="font-ui text-ui text-negro">
          {atCapacity ? `Alcanzaste el máximo de ${MAX_GALLERY_IMAGES} imágenes` : "Arrastra imágenes aquí o elige archivos"}
        </p>
        <p className="font-body text-caption text-grafito">
          JPG, PNG, WebP o AVIF · máx. 5 MB por archivo · hasta {MAX_GALLERY_IMAGES} imágenes
        </p>
      </label>

      {cards.length === 0 ? (
        <p className="font-body text-caption text-grafito">Sin imágenes todavía.</p>
      ) : (
        <div className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card, index) => (
            <div
              key={card.key}
              draggable={!busy}
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedIndex !== null && draggedIndex !== index) setDropTargetIndex(index);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDropTargetIndex(null);
              }}
              onDrop={handleCardDrop(index)}
              className={cn(
                "flex flex-col overflow-hidden rounded-card border border-borde bg-surface transition-opacity duration-150",
                draggedIndex === index && "opacity-50",
                dropTargetIndex === index && "outline-2 outline-offset-2 outline-negro",
              )}
            >
              <div className="relative">
                {card.isLocal ? (
                  // Local blob: URL from a file just staged — next/image can't optimize a client-only object URL.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.src} alt={card.alt} className="aspect-square w-full object-cover" />
                ) : (
                  <Image
                    src={card.src}
                    alt={card.alt}
                    width={card.width ?? 0}
                    height={card.height ?? 0}
                    className="aspect-square w-full object-cover"
                  />
                )}
                {index === 0 ? (
                  <Badge variant="accent" className="absolute left-xs top-xs">
                    Portada
                  </Badge>
                ) : null}
                <span
                  aria-hidden="true"
                  className="absolute right-xs top-xs cursor-grab rounded-control bg-overlay/60 p-xs text-blanco"
                >
                  <DotsSixVertical size={16} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-xs border-t border-borde p-xs">
                <ButtonGroup label="Reordenar imagen">
                  <Button
                    variant="bare"
                    size="icon"
                    aria-label="Mover antes"
                    disabled={busy || index === 0}
                    onClick={() => void commitMove(index, index - 1)}
                    iconLeft={<CaretLeft />}
                  />
                  <Button
                    variant="bare"
                    size="icon"
                    aria-label="Mover después"
                    disabled={busy || index === cards.length - 1}
                    onClick={() => void commitMove(index, index + 1)}
                    iconLeft={<CaretRight />}
                  />
                </ButtonGroup>
                <Button
                  variant="bare"
                  size="icon"
                  tone="danger-strong"
                  aria-label="Eliminar imagen"
                  disabled={busy}
                  onClick={() => void handleRemoveCard(card.key)}
                  iconLeft={<Trash />}
                />
              </div>
              {props.mode === "immediate" && props.availableColors && props.onColorChange ? (
                <div className="flex flex-col gap-xs border-t border-borde p-xs">
                  <Select
                    label="Color"
                    value={card.color ?? ""}
                    disabled={busy}
                    onChange={(event) => void handleColorChange(card.key, event.target.value)}
                  >
                    <option value="">Sin asignar</option>
                    {[...new Set([...props.availableColors, ...(card.color ? [card.color] : [])])].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                  {card.color && !props.availableColors.includes(card.color) ? (
                    <p className="font-body text-caption text-estado-advertencia">
                      Este color ya no está en las variantes.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
