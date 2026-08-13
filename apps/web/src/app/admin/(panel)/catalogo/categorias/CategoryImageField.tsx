"use client";

import type { CategoryImage } from "@bw-bikes/shared";
import Image from "next/image";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api/error";

interface CategoryImageFieldImmediateProps {
  mode: "immediate";
  image?: CategoryImage;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}

interface CategoryImageFieldDeferredProps {
  mode: "deferred";
  /** Local object URL for the file picked so far — there's no category id yet to upload to. */
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onClear: () => void;
}

export type CategoryImageFieldProps = CategoryImageFieldImmediateProps | CategoryImageFieldDeferredProps;

/**
 * A category carries at most one image — the single-image sibling of
 * `GallerySection.tsx`'s product gallery: no reorder, no multi-select.
 *
 * Two modes:
 * - `immediate`: the category already exists, so selecting a file uploads it
 *   right away — same "hit the endpoint immediately, never batch into the
 *   surrounding form's save" discipline as the product gallery.
 * - `deferred`: the category doesn't exist yet (create flow, before the
 *   first "Guardar"). Selecting a file only stages it locally via `onSelect`
 *   — `CategoryFormModal` uploads it right after the category is created, so
 *   the admin picks the image once, up front, instead of saving twice.
 */
export function CategoryImageField(props: CategoryImageFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

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

  return (
    <div className="flex flex-col gap-sm">
      <span className="font-ui text-ui text-negro">Imagen</span>
      {hasPreview ? (
        <div className="flex items-center gap-md">
          {props.mode === "deferred" ? (
            // Local blob: URL from a file the admin just picked — next/image can't optimize a client-only object URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.previewUrl ?? undefined} alt="" className="h-16 w-16 rounded-control object-cover" />
          ) : (
            <Image
              src={props.image?.url ?? ""}
              alt={props.image?.alt ?? ""}
              width={props.image?.width ?? 64}
              height={props.image?.height ?? 64}
              className="h-16 w-16 rounded-control object-cover"
            />
          )}
          <Button variant="ghost" disabled={busy} onClick={() => void handleRemove()}>
            {props.mode === "deferred" ? "Quitar" : "Eliminar"}
          </Button>
        </div>
      ) : (
        <p className="font-body text-caption text-grafito">Sin imagen todavía.</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        disabled={busy}
        onChange={(event) => void handleFileSelected(event)}
        aria-label={hasPreview ? "Reemplazar imagen" : "Subir imagen"}
        className="font-body text-body text-negro"
      />
    </div>
  );
}
