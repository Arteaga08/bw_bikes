"use client";

import type {
  AdminAccessory,
  AdminBadge,
  AdminBike,
  AdminBrand,
  ProductImage,
  PublicAccessory,
  SpecGroup,
  SpecTemplate,
} from "@bw-bikes/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/use-toast";
import type { AccessoryInput, BikeInput } from "@/lib/api/admin-catalog";
import { adminAccessoriesApi, adminBikesApi } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { MAX_SPEC_GROUPS } from "@/lib/catalog/spec-groups";
import { centsToPriceInput, parsePriceToCents } from "@/lib/catalog/price";
import { BadgesPicker, MAX_PRODUCT_BADGES } from "./BadgesPicker";
import { BikeBasicsFields, type BikeBasicsValue } from "./BikeBasicsFields";
import { EditorSection } from "./EditorSection";
import { ErrorSummary, type ErrorSummaryEntry } from "./ErrorSummary";
import { PRODUCT_FIELD_IDS } from "./field-ids";
import { GallerySection, MAX_GALLERY_IMAGES } from "./GallerySection";
import { ProductBasicsSection, type ProductBasicsValue } from "./ProductBasicsSection";
import { ProductOrganizationFields, type CategoryTreeNode } from "./ProductOrganizationFields";
import { MAX_RELATED_ACCESSORIES, RelatedAccessoriesPicker } from "./RelatedAccessoriesPicker";
import { SpecSheetEditor } from "./SpecSheetEditor";
import { findDuplicateSkuIndices, MAX_VARIANTS, VariantsEditor, type VariantRow } from "./VariantsEditor";

export type ProductEditorKind = "bike" | "accessory";

export interface ProductEditorProps {
  kind: ProductEditorKind;
  mode: "create" | "edit";
  productId?: string;
  /**
   * An `AdminBike` when `kind === "bike"`, an `AdminAccessory` otherwise —
   * guaranteed by the two call sites (`bicicletas/[id]/page.tsx` and
   * `accesorios/[id]/page.tsx`), each of which only ever passes its own kind.
   */
  initialProduct?: AdminBike | AdminAccessory;
  categoryTree: CategoryTreeNode[];
  /** Active brands the "Marca" select offers — fetched by the page loader alongside the category tree. */
  brands: AdminBrand[];
  /** Active badges the picker offers — same fetch pattern as `brands`. */
  availableBadges: AdminBadge[];
  /** Active saved spec shapes (M10.3) — feeds the ficha técnica's "Aplicar plantilla" and autocomplete. */
  specTemplates: SpecTemplate[];
  /** This catalog's own list route (`/admin/catalogo/bicicletas` or `/admin/catalogo/accesorios`) — where Cancel goes and where a create redirects to (`${listPath}/${savedId}`). */
  listPath: string;
}

type FormErrors = Partial<
  Record<keyof ProductBasicsValue | keyof BikeBasicsValue | "variants", string>
>;

/** Where the error summary jumps to for each key `validate()` can report — "slug" is never validated, so it's absent on purpose. */
const ERROR_TARGET_IDS: Partial<Record<keyof FormErrors, string>> = {
  name: PRODUCT_FIELD_IDS.name,
  brand: PRODUCT_FIELD_IDS.brand,
  category: PRODUCT_FIELD_IDS.category,
  description: PRODUCT_FIELD_IDS.description,
  priceInput: PRODUCT_FIELD_IDS.priceInput,
  compareAtPriceInput: PRODUCT_FIELD_IDS.compareAtPriceInput,
  shortDescription: PRODUCT_FIELD_IDS.shortDescription,
  variants: "section-variants",
};

function buildErrorEntries(errors: FormErrors): ErrorSummaryEntry[] {
  const entries: ErrorSummaryEntry[] = [];
  for (const [key, message] of Object.entries(errors)) {
    const targetId = ERROR_TARGET_IDS[key as keyof FormErrors];
    if (message && targetId) entries.push({ targetId, message });
  }
  return entries;
}

function basicsFromProduct(product?: AdminBike | AdminAccessory): ProductBasicsValue {
  return {
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    brand: product?.brand.id ?? "",
    category: product?.category.id ?? "",
    description: product?.description ?? "",
    priceInput: product ? centsToPriceInput(product.price) : "",
    compareAtPriceInput: product?.compareAtPrice !== undefined ? centsToPriceInput(product.compareAtPrice) : "",
  };
}

function bikeBasicsFromProduct(product?: AdminBike): BikeBasicsValue {
  return { shortDescription: product?.shortDescription ?? "" };
}

function variantsFromProduct(product?: AdminBike | AdminAccessory): VariantRow[] {
  return (product?.variants ?? []).map((variant) => ({
    sku: variant.sku,
    size: variant.size ?? "",
    color: variant.color ?? "",
    priceInput: variant.price !== undefined ? centsToPriceInput(variant.price) : "",
    fulfillmentMode: variant.fulfillmentMode,
    ...(variant.preorderReleaseDate ? { preorderReleaseDate: variant.preorderReleaseDate } : {}),
    isActive: variant.isActive,
  }));
}

/**
 * The single orchestrator both `/catalogo/bicicletas/*` and
 * `/catalogo/accesorios/*` mount — the two catalogs share their entire
 * surface (basics, variants, spec sheet, gallery) except three bike-only
 * fields (short description, brake type, cross-sell), gated by `kind` right
 * where they'd otherwise appear. Same reasoning as `createProductService` on
 * the backend: one engine, two independent catalogs.
 *
 * Two save flows coexist because the backend genuinely has two independent
 * endpoints (there's no id to `PUT /spec-groups` against until the product
 * exists), but the user only ever sees one action: on `create`, the sheet
 * rides inside the single POST; on `edit`, "Guardar cambios" does the PATCH
 * and then the spec sheet's own `PUT`, in that order, before it reports
 * success. The gallery stays the one truly independent surface — it hits its
 * endpoints immediately per action (`GallerySection`), never bundled into a
 * save, because there's no undo for an upload already sitting in Cloudinary.
 */
export function ProductEditor({
  kind,
  mode,
  productId,
  initialProduct,
  categoryTree,
  brands,
  availableBadges,
  specTemplates,
  listPath,
}: ProductEditorProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Safe by construction (see `initialProduct`'s doc comment above) — the two
  // call sites never mix `kind` and the other catalog's DTO.
  const initialBike = kind === "bike" ? (initialProduct as AdminBike | undefined) : undefined;

  const [basics, setBasics] = useState<ProductBasicsValue>(() => basicsFromProduct(initialProduct));
  const [bike, setBike] = useState<BikeBasicsValue>(() => bikeBasicsFromProduct(initialBike));
  const [variants, setVariants] = useState<VariantRow[]>(() => variantsFromProduct(initialProduct));
  const [relatedAccessories, setRelatedAccessories] = useState<PublicAccessory[]>(
    () => initialBike?.relatedAccessories ?? [],
  );
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>(() => initialProduct?.specGroups ?? []);
  const [gallery, setGallery] = useState<ProductImage[]>(() => initialProduct?.gallery ?? []);
  const [badgeIds, setBadgeIds] = useState<string[]>(() => initialProduct?.badges.map((badge) => badge.id) ?? []);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const productApi = kind === "bike" ? adminBikesApi : adminAccessoriesApi;
  const entityLabel = kind === "bike" ? "Bicicleta" : "Accesorio";
  const errorEntries = buildErrorEntries(errors);

  // Only fires right after a failed `validate()` (the only place `errors` is
  // ever set) — lands the admin on the summary instead of making them hunt
  // six sections for the one red border.
  useEffect(() => {
    if (errorEntries.length > 0) errorSummaryRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only `errors` should re-trigger the focus jump
  }, [errors]);

  function validate(): { priceCents: number; compareAtPriceCents: number | null } | null {
    const nextErrors: FormErrors = {};

    if (!basics.name.trim()) nextErrors.name = "El nombre es obligatorio.";
    if (!basics.brand.trim()) nextErrors.brand = "La marca es obligatoria.";
    if (!basics.category) nextErrors.category = "Selecciona una categoría.";
    if (!basics.description.trim()) nextErrors.description = "La descripción es obligatoria.";

    const priceCents = parsePriceToCents(basics.priceInput);
    if (priceCents === null) nextErrors.priceInput = "Captura un precio válido.";

    let compareAtPriceCents: number | null = null;
    if (basics.compareAtPriceInput.trim()) {
      compareAtPriceCents = parsePriceToCents(basics.compareAtPriceInput);
      if (compareAtPriceCents === null) {
        nextErrors.compareAtPriceInput = "Captura un precio válido.";
      } else if (priceCents !== null && compareAtPriceCents <= priceCents) {
        nextErrors.compareAtPriceInput = "El precio anterior debe ser mayor al precio actual.";
      }
    }

    if (kind === "bike") {
      if (!bike.shortDescription.trim()) nextErrors.shortDescription = "La descripción corta es obligatoria.";
    }

    if (findDuplicateSkuIndices(variants).size > 0) {
      nextErrors.variants = "Hay SKU repetidos entre variantes — corrígelos antes de guardar.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || priceCents === null) return null;
    return { priceCents, compareAtPriceCents };
  }

  /**
   * The second half of a `edit`-mode save. Its own try/catch so a failure
   * here reports precisely — "the product saved, the sheet didn't" — instead
   * of falling into the generic "no se pudo guardar" from the outer catch,
   * which would wrongly imply nothing was persisted.
   */
  async function persistSpecSheet(id: string): Promise<boolean> {
    try {
      const saved = await productApi.replaceSpecGroups(id, specGroups);
      setSpecGroups(saved);
      return true;
    } catch (error) {
      toast({
        variant: "error",
        title: "Se guardó el producto, pero no la ficha técnica",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
      return false;
    }
  }

  async function handleSubmit(): Promise<void> {
    const validated = validate();
    if (!validated) return;
    const { priceCents, compareAtPriceCents } = validated;

    const resolvedVariants = variants.map((row) => {
      const overridePrice = row.priceInput.trim() ? parsePriceToCents(row.priceInput) : null;
      return {
        sku: row.sku.trim().toUpperCase(),
        ...(row.size.trim() ? { size: row.size.trim() } : {}),
        ...(row.color.trim() ? { color: row.color.trim() } : {}),
        ...(overridePrice !== null ? { price: overridePrice } : {}),
        fulfillmentMode: row.fulfillmentMode,
        ...(row.fulfillmentMode === "preorder" && row.preorderReleaseDate
          ? { preorderReleaseDate: row.preorderReleaseDate }
          : {}),
        isActive: row.isActive,
      };
    });

    const sharedPayload = {
      name: basics.name.trim(),
      ...(basics.slug.trim() ? { slug: basics.slug.trim() } : {}),
      brand: basics.brand.trim(),
      category: basics.category,
      description: basics.description.trim(),
      price: priceCents,
      ...(compareAtPriceCents !== null ? { compareAtPrice: compareAtPriceCents } : {}),
      variants: resolvedVariants,
      badges: badgeIds,
      // The sheet only rides along on create — on edit it's its own PUT,
      // fired below once the product itself has saved.
      ...(mode === "create" ? { specGroups } : {}),
    };

    setSubmitting(true);
    try {
      if (kind === "bike") {
        const payload: BikeInput = {
          ...sharedPayload,
          shortDescription: bike.shortDescription.trim(),
          relatedAccessories: relatedAccessories.map((accessory) => accessory.id),
        };
        const saved =
          mode === "create" ? await adminBikesApi.create(payload) : await adminBikesApi.update(productId!, payload);
        if (mode === "edit" && !(await persistSpecSheet(productId!))) return;
        afterSave(saved.id);
      } else {
        const payload: AccessoryInput = sharedPayload;
        const saved =
          mode === "create"
            ? await adminAccessoriesApi.create(payload)
            : await adminAccessoriesApi.update(productId!, payload);
        if (mode === "edit" && !(await persistSpecSheet(productId!))) return;
        afterSave(saved.id);
      }
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo guardar",
        description: error instanceof ApiError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function afterSave(savedId: string): void {
    if (mode === "create") {
      toast({ variant: "success", title: `${entityLabel} creada`, description: "Ahora puedes agregar galería." });
      // `listPath` is already this catalog's list route
      // (`/admin/catalogo/bicicletas` or `/admin/catalogo/accesorios`) since
      // M10.1 gave each catalog its own route — the edit route is a direct
      // child of it.
      router.replace(`${listPath}/${savedId}`);
    } else {
      toast({ variant: "success", title: "Cambios guardados" });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-lg p-md sm:p-lg">
        {errorEntries.length > 0 ? <ErrorSummary ref={errorSummaryRef} entries={errorEntries} /> : null}

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-lg">
          <div className="flex flex-col gap-lg">
            <EditorSection
              id="section-basics"
              title="Datos generales"
              description="Lo que describe el producto en la ficha pública."
            >
              <ProductBasicsSection value={basics} onChange={setBasics} errors={errors} />
              {kind === "bike" ? <BikeBasicsFields value={bike} onChange={setBike} errors={errors} /> : null}
            </EditorSection>

            <EditorSection
              id="section-variants"
              title="Variantes"
              description="Tallas, colores y SKUs que se pueden comprar por separado."
              count={{ current: variants.length, max: MAX_VARIANTS }}
            >
              {errors.variants ? <p className="font-body text-caption text-estado-error">{errors.variants}</p> : null}
              <VariantsEditor variants={variants} onChange={setVariants} />
            </EditorSection>

            <EditorSection
              id="section-specs"
              title="Ficha técnica"
              description="La etiqueta se repite entre productos, p. ej. «Peso»; el valor es el de este producto, p. ej. «8.2 kg»."
              count={{ current: specGroups.length, max: MAX_SPEC_GROUPS }}
            >
              <SpecSheetEditor groups={specGroups} onChange={setSpecGroups} templates={specTemplates} />
            </EditorSection>

            <EditorSection
              id="section-gallery"
              title="Galería"
              description="La primera imagen es la portada del producto en el storefront."
              count={{ current: gallery.length, max: MAX_GALLERY_IMAGES }}
            >
              <GallerySection
                productId={productId}
                gallery={gallery}
                onChange={setGallery}
                onUpload={(files) => productApi.uploadGallery(productId as string, files)}
                onRemove={(publicId) => productApi.removeGalleryImage(productId as string, publicId)}
                onReorder={(publicIds) => productApi.reorderGallery(productId as string, publicIds)}
              />
            </EditorSection>
          </div>

          <div className="flex flex-col gap-lg lg:sticky lg:top-lg">
            <EditorSection id="section-organization" title="Organización">
              <ProductOrganizationFields
                value={basics}
                onChange={(next) => setBasics({ ...basics, ...next })}
                categoryTree={categoryTree}
                brands={brands}
                errors={errors}
              />
            </EditorSection>

            <EditorSection
              id="section-badges"
              title="Badges"
              count={{ current: badgeIds.length, max: MAX_PRODUCT_BADGES }}
            >
              <BadgesPicker available={availableBadges} selected={badgeIds} onChange={setBadgeIds} />
            </EditorSection>

            {kind === "bike" ? (
              <EditorSection
                id="section-related"
                title="Accesorios sugeridos"
                description="Cross-sell curado a mano para la ficha de esta bicicleta."
                count={{ current: relatedAccessories.length, max: MAX_RELATED_ACCESSORIES }}
              >
                <RelatedAccessoriesPicker selected={relatedAccessories} onChange={setRelatedAccessories} />
              </EditorSection>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-md border-t border-borde bg-base p-md sm:p-lg">
        {errorEntries.length > 0 ? (
          <p className="font-ui text-caption text-estado-error">
            {errorEntries.length === 1 ? "1 campo por corregir" : `${errorEntries.length} campos por corregir`}
          </p>
        ) : (
          <span />
        )}
        <div className="flex gap-sm">
          <Button variant="ghost" onClick={() => router.push(listPath)}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>
            {mode === "create" ? `Crear ${entityLabel.toLowerCase()}` : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
