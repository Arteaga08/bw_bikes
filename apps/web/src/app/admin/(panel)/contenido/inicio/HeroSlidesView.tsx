"use client";

import type { AdminAccessory, AdminBike, AdminCategory, AdminHeroSlide, HeroCtaTargetType } from "@bw-bikes/shared";
import { MAX_HERO_SLIDES } from "@bw-bikes/shared";
import { DotsSixVertical, ImagesSquare, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ComboboxOption } from "@/components/ui/Combobox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { useToast } from "@/hooks/use-toast";
import {
  createHeroSlide,
  deleteHeroSlide,
  reorderHeroSlides,
  updateHeroSlide,
  uploadHeroSlideImage,
  removeHeroSlideImage,
} from "@/lib/api/admin-content";
import { ApiError } from "@/lib/api/error";
import { EditorSection } from "../../catalogo/EditorSection";

// Code-split the same way `CategoriesView` splits its form modal — only
// mounted once the admin opens "Agregar slide"/"Editar", so the form plus
// its image-upload machinery stays out of the initial bundle.
const HeroSlideFormModal = dynamic(() => import("./HeroSlideFormModal").then((mod) => mod.HeroSlideFormModal), {
  ssr: false,
});

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function toOptions(items: { id: string; name: string }[]): ComboboxOption[] {
  return items.map((item) => ({ id: item.id, label: item.name }));
}

function toCategoryOptions(items: AdminCategory[]): ComboboxOption[] {
  return items.map((item) => ({ id: item.id, label: item.name }));
}

export interface HeroSlidesViewProps {
  initialSlides: AdminHeroSlide[];
  bikes: AdminBike[];
  accessories: AdminAccessory[];
  bikeCategories: AdminCategory[];
  accessoryCategories: AdminCategory[];
}

interface FormDialogState {
  mode: "create" | "edit";
  slide?: AdminHeroSlide;
}

interface DeleteDialogState {
  id: string;
  title: string;
}

/**
 * Ordered, draggable list of the hero's slides — up to `MAX_HERO_SLIDES`.
 * `useDragReorder` (the same hook `GallerySection`'s gallery reordering
 * would use if it were touch-driven) drives the drag gesture; the actual
 * commit is one `PUT .../reorder` call per drop; the whole slide, not
 * derived positions, comes back from that response so the list never drifts
 * from what the API actually persisted.
 */
export function HeroSlidesView({ initialSlides, bikes, accessories, bikeCategories, accessoryCategories }: HeroSlidesViewProps) {
  const { toast } = useToast();
  const [slides, setSlides] = useState(initialSlides);
  const [formDialog, setFormDialog] = useState<FormDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleting, setDeleting] = useState(false);

  const catalogOptionsByType = useMemo<Record<Exclude<HeroCtaTargetType, "url">, ComboboxOption[]>>(
    () => ({
      bike: toOptions(bikes),
      accessory: toOptions(accessories),
      bikeCategory: toCategoryOptions(bikeCategories),
      accessoryCategory: toCategoryOptions(accessoryCategories),
    }),
    [bikes, accessories, bikeCategories, accessoryCategories],
  );

  async function refetch(): Promise<void> {
    const { listAdminHeroSlides } = await import("@/lib/api/admin-content");
    setSlides(await listAdminHeroSlides());
  }

  async function handleReorder(from: number, to: number): Promise<void> {
    const reordered = [...slides];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved!);
    setSlides(reordered); // optimistic — the request below reconciles it

    try {
      const saved = await reorderHeroSlides(reordered.map((slide) => slide.id));
      setSlides(saved);
    } catch (error) {
      setSlides(slides); // revert
      toast({ variant: "error", title: "No se pudo reordenar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    }
  }

  const { draggingIndex, dropTargetIndex, registerRow, getHandleProps } = useDragReorder({
    itemCount: slides.length,
    onReorder: (from, to) => void handleReorder(from, to),
  });

  async function handleDelete(): Promise<void> {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      await deleteHeroSlide(deleteDialog.id);
      setSlides((current) => current.filter((slide) => slide.id !== deleteDialog.id));
      toast({ variant: "success", title: "Slide eliminado" });
      setDeleteDialog(null);
    } catch (error) {
      toast({ variant: "error", title: "No se pudo eliminar", description: apiErrorMessage(error, "Intenta de nuevo.") });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <EditorSection
      id="hero-slides"
      title="Carrusel de inicio"
      description="Las fotos, textos y botones del carrusel que abre la página de inicio."
      count={{ current: slides.length, max: MAX_HERO_SLIDES }}
      actions={
        <Button
          variant="secondary"
          iconLeft={<Plus />}
          disabled={slides.length >= MAX_HERO_SLIDES}
          onClick={() => setFormDialog({ mode: "create" })}
        >
          Agregar slide
        </Button>
      }
    >
      {slides.length === 0 ? (
        <EmptyState
          icon={<ImagesSquare size={32} aria-hidden="true" />}
          title="Todavía no hay slides"
          description="El hero de inicio se queda en blanco hasta que agregues al menos uno."
          action={
            <Button variant="primary" iconLeft={<Plus />} onClick={() => setFormDialog({ mode: "create" })}>
              Agregar el primero
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-sm">
          {slides.map((slide, index) => (
            <li
              key={slide.id}
              ref={registerRow(index)}
              className={`flex items-center gap-sm rounded-card border border-borde bg-surface p-sm transition-opacity ${
                draggingIndex === index ? "opacity-50" : ""
              } ${dropTargetIndex === index && draggingIndex !== index ? "outline outline-2 outline-dorado" : ""}`}
            >
              <button
                type="button"
                aria-label={`Reordenar "${slide.title}"`}
                className="cursor-grab touch-none rounded-control p-xs text-grafito hover:text-negro active:cursor-grabbing"
                {...getHandleProps(index)}
              >
                <DotsSixVertical size={20} aria-hidden="true" />
              </button>

              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-control bg-inset">
                {slide.image ? (
                  <Image src={slide.image.url} alt={slide.image.alt ?? slide.title} fill sizes="96px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-grafito">
                    <ImagesSquare size={20} aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-ui text-ui text-negro">{slide.title}</p>
                <p className="truncate font-body text-caption text-grafito">
                  {slide.ctas.length} botón{slide.ctas.length === 1 ? "" : "es"}
                  {slide.ctas.some((cta) => cta.isBroken) ? " · destino roto" : ""}
                </p>
              </div>

              <Badge variant={slide.isActive ? "accent" : "neutral"}>{slide.isActive ? "Activo" : "Inactivo"}</Badge>

              <Button
                variant="bare"
                size="icon-sm"
                aria-label="Editar slide"
                onClick={() => setFormDialog({ mode: "edit", slide })}
              >
                <PencilSimple size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="bare"
                tone="danger-strong"
                size="icon-sm"
                aria-label="Eliminar slide"
                onClick={() => setDeleteDialog({ id: slide.id, title: slide.title })}
              >
                <Trash size={16} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {formDialog ? (
        <HeroSlideFormModal
          onClose={() => setFormDialog(null)}
          onCreate={createHeroSlide}
          onUpdate={updateHeroSlide}
          onUploadImage={uploadHeroSlideImage}
          onRemoveImage={removeHeroSlideImage}
          onChanged={() => void refetch()}
          initial={formDialog.mode === "edit" ? formDialog.slide : undefined}
          catalogOptionsByType={catalogOptionsByType}
        />
      ) : null}

      {deleteDialog ? (
        <Modal
          open
          onClose={() => setDeleteDialog(null)}
          title="Eliminar slide"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteDialog(null)}>
                Cancelar
              </Button>
              <Button variant="primary" loading={deleting} onClick={() => void handleDelete()}>
                Eliminar
              </Button>
            </>
          }
        >
          <p className="font-body text-body text-grafito">
            ¿Eliminar el slide «{deleteDialog.title}»? Esta acción no se puede deshacer.
          </p>
        </Modal>
      ) : null}
    </EditorSection>
  );
}
