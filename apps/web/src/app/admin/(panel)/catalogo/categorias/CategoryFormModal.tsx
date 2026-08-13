"use client";

import type { AdminCategory } from "@bw-bikes/shared";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import type { CategoryInput } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { slugify } from "@/lib/catalog/slugify";
import { CategoryImageField } from "./CategoryImageField";

export interface CategoryFormModalProps {
  onClose: () => void;
  onCreate: (input: CategoryInput) => Promise<AdminCategory>;
  onUpdate: (id: string, input: Partial<CategoryInput>) => Promise<AdminCategory>;
  onUploadImage: (id: string, file: File) => Promise<AdminCategory>;
  onRemoveImage: (id: string) => Promise<AdminCategory>;
  /** Refetches the background tree (row list, thumbnails) — the modal itself stays open and keeps its own local `category` state. */
  onChanged: () => void;
  /** Root categories of the same tree — the only valid parent options, since the hierarchy is two levels max. */
  rootOptions: AdminCategory[];
  /** Present when editing; absent when creating a new category. */
  initial?: AdminCategory;
  /** Preselects "Categoría padre" on create — used by the root row's "Agregar subcategoría" action. Ignored when `initial` is set. */
  defaultParent?: string;
}

/**
 * Create/edit form for one category, in either tree. The five fields the
 * backend accepts (`categoryInput` in `apps/api/src/validators/category.validator.ts`):
 * name, slug, description, parent, order, plus `isActive` — and, once the
 * category exists, its image.
 *
 * Image upload needs an id (Cloudinary attaches to an existing document, same
 * constraint as the product gallery). Rather than making the admin save
 * twice, the create flow lets them pick the file up front: before the
 * category exists, `CategoryImageField` runs in `"deferred"` mode and just
 * hands the picked `File` back via `onSelect` (previewed locally with
 * `URL.createObjectURL`, never uploaded). The first "Guardar" then creates
 * the category and, if a file was staged, uploads it immediately after —
 * one click, one round trip the admin actually notices. If that upload step
 * fails, the category still exists (it's already saved), so the field
 * switches to `"immediate"` mode in place and the admin retries the upload
 * directly from there, no data lost.
 *
 * `category` is local state, not a mirror of `initial` — it starts there,
 * but the first successful "Guardar" on a new category replaces it with what
 * the API just created. From that point on "Guardar" edits in place and
 * "Cerrar" (no longer "Cancelar", because there's now something saved to
 * walk away from) leaves the modal.
 */
export function CategoryFormModal({
  onClose,
  onCreate,
  onUpdate,
  onUploadImage,
  onRemoveImage,
  onChanged,
  rootOptions,
  initial,
  defaultParent,
}: CategoryFormModalProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState<AdminCategory | undefined>(initial);
  const [name, setName] = useState(initial?.name ?? "");
  // Never typed by the admin — mirrors `ProductBasicsValue.slug` in
  // `ProductBasicsSection.tsx`: the already-persisted slug on edit, or empty
  // on create (the field below shows a live `slugify(name)` preview instead).
  const [slug] = useState(initial?.slug ?? "");
  const slugPreview = slug || slugify(name);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [parent, setParent] = useState(initial?.parent ?? defaultParent ?? "");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  // Staged locally before the category exists — see this component's doc
  // comment. `pendingPreviewUrl` is a `blob:` URL created from `pendingFile`,
  // revoked whenever it's replaced or the modal unmounts.
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

  // A category can't be re-parented under itself.
  const parentOptions = rootOptions.filter((root) => root.id !== category?.id);

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

  async function handleSubmit(): Promise<void> {
    if (!name.trim()) {
      setNameError("El nombre es obligatorio.");
      return;
    }
    setNameError(undefined);
    setSubmitting(true);
    try {
      const input: CategoryInput = {
        name: name.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        parent: parent || null,
        order: Number.parseInt(order, 10) || 0,
        isActive,
      };
      const wasCreate = !category;
      const saved = category ? await onUpdate(category.id, input) : await onCreate(input);
      toast({ variant: "success", title: category ? "Cambios guardados" : "Categoría creada" });
      setCategory(saved);
      onChanged();

      if (wasCreate && pendingFile) {
        const fileToUpload = pendingFile;
        handleClearPendingImage();
        try {
          const withImage = await onUploadImage(saved.id, fileToUpload);
          setCategory(withImage);
          onChanged();
        } catch (uploadError) {
          toast({
            variant: "error",
            title: "Se creó la categoría, pero no se pudo subir la imagen",
            description:
              uploadError instanceof ApiError ? uploadError.message : "Puedes intentarlo de nuevo desde aquí mismo.",
          });
        }
      }
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo guardar la categoría",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // `CategoryImageField` owns its own success/error toasts — these just
  // forward the network call and update local + background state.
  async function handleUploadImage(file: File): Promise<void> {
    if (!category) return;
    const saved = await onUploadImage(category.id, file);
    setCategory(saved);
    onChanged();
  }

  async function handleRemoveImage(): Promise<void> {
    if (!category) return;
    const saved = await onRemoveImage(category.id);
    setCategory(saved);
    onChanged();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? "Editar categoría" : "Nueva categoría"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {category ? "Cerrar" : "Cancelar"}
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            {category ? "Guardar cambios" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <Input label="Nombre" required value={name} onChange={(event) => setName(event.target.value)} error={nameError} />
        <Input label="Slug" helper="Se genera automáticamente del nombre." value={slugPreview} disabled readOnly />
        <Textarea label="Descripción (opcional)" value={description} onChange={(event) => setDescription(event.target.value)} />
        <Select label="Categoría padre" value={parent} onChange={(event) => setParent(event.target.value)}>
          <option value="">— (raíz)</option>
          {parentOptions.map((root) => (
            <option key={root.id} value={root.id}>
              {root.name}
            </option>
          ))}
        </Select>
        <Input label="Orden" type="number" min={0} value={order} onChange={(event) => setOrder(event.target.value)} />
        <Toggle label="Activa" checked={isActive} onChange={setIsActive} />

        {category ? (
          <CategoryImageField mode="immediate" image={category.image} onUpload={handleUploadImage} onRemove={handleRemoveImage} />
        ) : (
          <CategoryImageField
            mode="deferred"
            previewUrl={pendingPreviewUrl}
            onSelect={handleSelectPendingImage}
            onClear={handleClearPendingImage}
          />
        )}
      </div>
    </Modal>
  );
}
