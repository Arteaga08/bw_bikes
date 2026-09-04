"use client";

import type { AdminBrand } from "@bw-bikes/shared";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import { adminBrandsApi, type BrandInput } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { slugify } from "@/lib/catalog/slugify";
import { ImageField } from "@/components/ui/ImageField";

export interface BrandFormModalProps {
  onClose: () => void;
  /** Fired after every successful save (create, update, or the logo upload that follows a create) — refetches the background list. */
  onSaved: () => void;
  /** Present when editing; absent when creating a new brand. */
  initial?: AdminBrand;
}

/**
 * Create/edit form for a brand. Same deferred-logo trick
 * `CategoryFormModal` uses for its image: before the brand exists there's no
 * id to upload a logo to, so `ImageField` runs in `"deferred"` mode
 * and stages the picked file locally; the first "Guardar" creates the brand
 * and, if a file was staged, uploads it right after — one click, not two
 * saves. `ImageField` is reused as-is: a brand's `logo` is the exact
 * same `CategoryImage` shape as a category's `image`.
 */
export function BrandFormModal({ onClose, onSaved, initial }: BrandFormModalProps) {
  const { toast } = useToast();
  const [brand, setBrand] = useState<AdminBrand | undefined>(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug] = useState(initial?.slug ?? "");
  const slugPreview = slug || slugify(name);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

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

  function handleSelectPendingLogo(file: File): void {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  }

  function handleClearPendingLogo(): void {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
  }

  async function handleUploadLogo(file: File): Promise<void> {
    if (!brand) return;
    const saved = await adminBrandsApi.uploadLogo(brand.id, file);
    setBrand(saved);
    onSaved();
  }

  async function handleRemoveLogo(): Promise<void> {
    if (!brand) return;
    const saved = await adminBrandsApi.removeLogo(brand.id);
    setBrand(saved);
    onSaved();
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors: { name?: string } = {};
    if (!name.trim()) nextErrors.name = "El nombre es obligatorio.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const input: BrandInput = {
        name: name.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        order: Number.parseInt(order, 10) || 0,
        isActive,
      };
      const wasCreate = !brand;
      const saved = brand ? await adminBrandsApi.update(brand.id, input) : await adminBrandsApi.create(input);
      toast({ variant: "success", title: brand ? "Cambios guardados" : "Marca creada" });
      setBrand(saved);
      onSaved();

      if (wasCreate && pendingFile) {
        const fileToUpload = pendingFile;
        handleClearPendingLogo();
        try {
          await adminBrandsApi.uploadLogo(saved.id, fileToUpload);
          onSaved();
        } catch (uploadError) {
          toast({
            variant: "error",
            title: "Se creó la marca, pero no se pudo subir el logo",
            description:
              uploadError instanceof ApiError ? uploadError.message : "Puedes intentarlo de nuevo desde aquí mismo.",
          });
        }
      }
      onClose();
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo guardar la marca",
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
      title={brand ? "Editar marca" : "Nueva marca"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {brand ? "Cerrar" : "Cancelar"}
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            {brand ? "Guardar cambios" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        <Input label="Nombre" required value={name} onChange={(event) => setName(event.target.value)} error={errors.name} />
        <Input
          label="Slug"
          helper="Se genera automáticamente del nombre — identifica la marca en filtros y en las URLs públicas."
          value={slugPreview}
          disabled
          readOnly
        />
        <Textarea label="Descripción (opcional)" value={description} onChange={(event) => setDescription(event.target.value)} />
        <Input label="Orden" type="number" min={0} value={order} onChange={(event) => setOrder(event.target.value)} />
        <Toggle label="Activa" checked={isActive} onChange={setIsActive} />

        {brand ? (
          <ImageField mode="immediate" image={brand.logo} onUpload={handleUploadLogo} onRemove={handleRemoveLogo} />
        ) : (
          <ImageField
            mode="deferred"
            previewUrl={pendingPreviewUrl}
            onSelect={handleSelectPendingLogo}
            onClear={handleClearPendingLogo}
          />
        )}
      </div>
    </Modal>
  );
}
