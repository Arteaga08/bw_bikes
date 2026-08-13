"use client";

import type { ProductImage } from "@bw-bikes/shared";
import { CaretLeft, CaretRight, DotsSixVertical, ImagesSquare, Trash } from "@phosphor-icons/react";
import Image from "next/image";
import type { ChangeEvent, DragEvent } from "react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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

export interface GallerySectionProps {
  /** Absent means the product hasn't been created yet — the upload endpoint requires an existing id. */
  productId?: string;
  gallery: ProductImage[];
  onChange: (gallery: ProductImage[]) => void;
  onUpload: (files: File[]) => Promise<ProductImage[]>;
  onRemove: (publicId: string) => Promise<ProductImage[]>;
  onReorder: (publicIds: string[]) => Promise<ProductImage[]>;
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

/**
 * Every action here hits its own endpoint immediately and refreshes from the
 * response — the gallery is never part of the surrounding form's save, same
 * discipline as `GallerySection`'s backend routes (`POST`/`DELETE`/
 * `PATCH .../gallery*`), which never touch the rest of the product document.
 */
export function GallerySection({ productId, gallery, onChange, onUpload, onRemove, onReorder }: GallerySectionProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  if (!productId) {
    return (
      <p className="font-body text-caption text-grafito">
        Guarda el producto para poder subir imágenes a la galería.
      </p>
    );
  }

  const atCapacity = gallery.length >= MAX_GALLERY_IMAGES;

  async function processFiles(files: File[]): Promise<void> {
    if (files.length === 0 || busy || atCapacity) return;

    const { accepted, rejectedNames } = partitionUploadable(files, MAX_GALLERY_IMAGES - gallery.length);
    if (rejectedNames.length > 0) {
      toast({
        variant: "warning",
        title: rejectedNames.length === 1 ? "Una imagen no se pudo agregar" : "Algunas imágenes no se pudieron agregar",
        description: `${rejectedNames.join(", ")} — revisa que pese menos de 5 MB y que haya cupo disponible.`,
      });
    }
    if (accepted.length === 0) return;

    setBusy(true);
    try {
      onChange(await onUpload(accepted));
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

  async function handleRemove(publicId: string): Promise<void> {
    setBusy(true);
    try {
      onChange(await onRemove(publicId));
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

  /** The one place a reorder is actually persisted — shared by the keyboard-reachable arrow buttons and drag-and-drop. */
  async function commitMove(from: number, to: number): Promise<void> {
    const reordered = moveImage(gallery, from, to);
    if (reordered === gallery) return;

    setBusy(true);
    try {
      onChange(await onReorder(reordered.map((image) => image.publicId)));
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
          dragOver ? "border-negro bg-surface" : "border-borde bg-base",
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

      {gallery.length === 0 ? (
        <p className="font-body text-caption text-grafito">Sin imágenes todavía.</p>
      ) : (
        <div className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4">
          {gallery.map((image, index) => (
            <div
              key={image.publicId}
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
                <Image
                  src={image.url}
                  alt={image.alt ?? ""}
                  width={image.width}
                  height={image.height}
                  className="aspect-square w-full object-cover"
                />
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
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mover antes"
                  disabled={busy || index === 0}
                  onClick={() => void commitMove(index, index - 1)}
                >
                  <CaretLeft aria-hidden="true" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mover después"
                  disabled={busy || index === gallery.length - 1}
                  onClick={() => void commitMove(index, index + 1)}
                >
                  <CaretRight aria-hidden="true" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Eliminar imagen"
                  disabled={busy}
                  onClick={() => void handleRemove(image.publicId)}
                >
                  <Trash aria-hidden="true" size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
