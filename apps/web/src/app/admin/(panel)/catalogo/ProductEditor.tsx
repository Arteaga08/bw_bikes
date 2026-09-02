"use client";

import type {
  AdminAccessory,
  AdminBadge,
  AdminBike,
  AdminBrand,
  CategoryImage,
  ColorTemplate,
  ProductImage,
  PublicAccessory,
  SizeTemplate,
  SpecGroup,
  SpecTemplate,
  SummaryRow,
} from "@bw-bikes/shared";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/hooks/use-toast";
import type { AccessoryInput, BikeInput } from "@/lib/api/admin-catalog";
import { adminAccessoriesApi, adminBikesApi } from "@/lib/api/admin-catalog";
import { ApiError } from "@/lib/api/error";
import { findSpecSheetError, MAX_SPEC_GROUPS, pruneEmptyFields, type SpecSheetError } from "@/lib/catalog/spec-groups";
import { MAX_SUMMARY_ROWS } from "@/lib/catalog/summary";
import { centsToPriceInput, parsePriceToCents } from "@/lib/catalog/price";
import { MAX_MODEL_YEAR, MIN_MODEL_YEAR } from "./catalog-limits";
import { BadgesPicker, MAX_PRODUCT_BADGES } from "./BadgesPicker";
import { BikeBasicsFields, type BikeBasicsValue } from "./BikeBasicsFields";
import { CategoryImageField } from "./categorias/CategoryImageField";
import {
  EDITOR_STEPS,
  type EditorStepId,
  firstStepWithErrors,
  type FormErrors,
  stepForErrorKey,
  stepHasErrors,
  stepIdAt,
  stepIndex,
} from "./editor-steps";
import { EditorFooter } from "./EditorFooter";
import { EditorSection } from "./EditorSection";
import { EditorStepper } from "./EditorStepper";
import { ErrorSummary, type ErrorSummaryEntry } from "./ErrorSummary";
import { PRODUCT_FIELD_IDS } from "./field-ids";
import { MAX_GALLERY_IMAGES } from "./catalog-limits";
import type { StagedGalleryFile } from "./GallerySection";
import { ProductBasicsSection, type ProductBasicsValue } from "./ProductBasicsSection";
import { findCategoryById, ProductOrganizationFields, type CategoryTreeNode } from "./ProductOrganizationFields";
import { MAX_RELATED_ACCESSORIES, RelatedAccessoriesPicker } from "./RelatedAccessoriesPicker";
import { SectionHelp } from "./SectionHelp";
import { SizePicker } from "./SizePicker";
import { SummaryEditor } from "./SummaryEditor";
import { findDuplicateSkuIndices, MAX_VARIANTS, VariantsEditor, type VariantRow } from "./VariantsEditor";

/**
 * Code-split, same pattern as `OrdersView.tsx`'s `OrderDetailModal` — these
 * are two of the largest step components in this stepper (400+ lines each)
 * and the wizard already renders only the active step's JSX (the `switch`
 * below), so nothing was ever mounting both at once; the only thing a
 * static import was buying was shipping both in the *first* step's JS
 * regardless of whether the admin ever reaches "Galería"/"Ficha técnica".
 * `MAX_GALLERY_IMAGES` still comes from `./catalog-limits`, not this import
 * — pulling a value straight from `GallerySection.tsx` here would force
 * that whole module back into the eager bundle no matter how the component
 * itself is loaded.
 */
const GallerySection = dynamic(() => import("./GallerySection").then((mod) => mod.GallerySection), { ssr: false });
const SpecSheetEditor = dynamic(() => import("./SpecSheetEditor").then((mod) => mod.SpecSheetEditor), { ssr: false });

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
  /**
   * The accessory-categories tree, fetched independently of `categoryTree`
   * even when `kind === "accessory"` (where the two would otherwise be the
   * same tree) — `RelatedAccessoriesPicker` only ever renders for
   * `kind === "bike"`, whose own `categoryTree` is the *bike*-categories
   * tree instead. Optional because the accessory editor's two pages never
   * fetch or pass it, having no cross-sell picker of their own.
   */
  accessoryCategoryTree?: CategoryTreeNode[];
  /** Active brands the "Marca" select offers — fetched by the page loader alongside the category tree. */
  brands: AdminBrand[];
  /** Active badges the picker offers — same fetch pattern as `brands`. */
  availableBadges: AdminBadge[];
  /** Active saved spec shapes (M10.3) — feeds the ficha técnica's "Aplicar plantilla" and autocomplete. */
  specTemplates: SpecTemplate[];
  /** Saved sizes (M10.7 S1) — feeds "Tallas y variantes"' chip picker (`SizePicker`). */
  sizeTemplates: SizeTemplate[];
  /** Saved colors, one shared catalog for both kinds — feeds "Tallas y variantes"' row-level color `<Select>` (`VariantsEditor`). */
  colorTemplates: ColorTemplate[];
  /** This catalog's own list route (`/admin/catalogo/bicicletas` or `/admin/catalogo/accesorios`) — where Cancel goes and where a create redirects to (`${listPath}/${savedId}`). */
  listPath: string;
}

/** Where the error summary jumps to for each key `validate()` can report — "slug" is never validated, so it's absent on purpose. */
const ERROR_TARGET_IDS: Partial<Record<keyof FormErrors, string>> = {
  name: PRODUCT_FIELD_IDS.name,
  brand: PRODUCT_FIELD_IDS.brand,
  category: PRODUCT_FIELD_IDS.category,
  description: PRODUCT_FIELD_IDS.description,
  priceInput: PRODUCT_FIELD_IDS.priceInput,
  compareAtPriceInput: PRODUCT_FIELD_IDS.compareAtPriceInput,
  shortDescription: PRODUCT_FIELD_IDS.shortDescription,
  modelYear: PRODUCT_FIELD_IDS.modelYear,
  variants: "section-variants",
  specGroups: "section-specs",
};

/**
 * Each entry's `beforeJump` switches to the step that owns the field before
 * `ErrorSummary` looks it up by id — a field from a step other than the one
 * on screen simply isn't in the DOM yet otherwise.
 */
function buildErrorEntries(errors: FormErrors, onJumpToStep: (stepId: EditorStepId) => void): ErrorSummaryEntry[] {
  const entries: ErrorSummaryEntry[] = [];
  for (const [key, message] of Object.entries(errors)) {
    const typedKey = key as keyof FormErrors;
    const targetId = ERROR_TARGET_IDS[typedKey];
    if (!message || !targetId) continue;
    const ownerStepId = stepForErrorKey(typedKey);
    entries.push({ targetId, message, beforeJump: ownerStepId ? () => onJumpToStep(ownerStepId) : undefined });
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
  return {
    shortDescription: product?.shortDescription ?? "",
    modelYear: product?.modelYear !== undefined ? String(product.modelYear) : "",
  };
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
    // `isNewRow` intentionally omitted — a row hydrated from a persisted
    // product keeps its own SKU frozen and never re-shows "Stock inicial".
  }));
}

/** Reads `?paso=N` (1-indexed, matching what the stepper displays) off the URL, clamped to a real step — absent or garbage both fall back to the first step. */
function initialStepIdFrom(searchParams: URLSearchParams): EditorStepId {
  const raw = searchParams.get("paso");
  const n = raw ? Number.parseInt(raw, 10) : 1;
  return stepIdAt(Number.isFinite(n) ? n - 1 : 0);
}

/**
 * `useSearchParams` requires a `Suspense` ancestor — this boundary exists
 * purely for that; nothing here actually suspends; both `page.tsx` call
 * sites already force this route dynamic via `serverApiFetch`'s `cookies()`
 * read, so no loading flash ever shows in practice.
 */
export function ProductEditor(props: ProductEditorProps) {
  return (
    <Suspense fallback={null}>
      <ProductEditorContent {...props} />
    </Suspense>
  );
}

/**
 * The single orchestrator both `/catalogo/bicicletas/*` and
 * `/catalogo/accesorios/*` mount — the two catalogs share their entire
 * surface (basics, variants, spec sheet, gallery) except three bike-only
 * fields (short description, brake type, cross-sell), gated by `kind` right
 * where they'd otherwise appear. Same reasoning as `createProductService` on
 * the backend: one engine, two independent catalogs.
 *
 * Presented as a 5-step flow (`editor-steps.ts`) instead of one long page:
 * `create` gates "Siguiente" on each step's own errors so a half-empty
 * basics step can't be skipped past; `edit` unlocks every step immediately
 * (the product already has all its data) and keeps "Guardar cambios"
 * available from any of them.
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
function ProductEditorContent({
  kind,
  mode,
  productId,
  initialProduct,
  categoryTree,
  accessoryCategoryTree,
  brands,
  availableBadges,
  specTemplates,
  sizeTemplates,
  colorTemplates,
  listPath,
}: ProductEditorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [summary, setSummary] = useState<SummaryRow[]>(() => initialBike?.summary ?? []);
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>(() => initialProduct?.specGroups ?? []);
  const [gallery, setGallery] = useState<ProductImage[]>(() => initialProduct?.gallery ?? []);

  // Feeds `VariantsEditor`'s SKU auto-generation — recomputed from `brands`/`basics.brand` on every render rather than cached in state, same reasoning as any other derived-from-props value.
  const brandName = brands.find((candidate) => candidate.id === basics.brand)?.name ?? "";

  // Feeds `GallerySection`'s per-photo color tag — distinct colors typed into
  // the product's variants so far, first-appearance order (same dedupe
  // pattern as `SizePicker`'s own `sizesInUse`).
  const availableColors = (() => {
    const seen = new Set<string>();
    const colors: string[] = [];
    for (const variant of variants) {
      const color = variant.color.trim();
      if (!color || seen.has(color)) continue;
      seen.add(color);
      colors.push(color);
    }
    return colors;
  })();
  const [badgeIds, setBadgeIds] = useState<string[]>(() => initialProduct?.badges.map((badge) => badge.id) ?? []);
  const [isNewArrival, setIsNewArrival] = useState<boolean>(() => initialProduct?.isNewArrival ?? false);
  const [isCustomerFavorite, setIsCustomerFavorite] = useState<boolean>(
    () => initialProduct?.isCustomerFavorite ?? false,
  );

  const [currentStepId, setCurrentStepId] = useState<EditorStepId>(() => initialStepIdFrom(searchParams));
  // Which steps the admin can jump straight to from the stepper. `edit`
  // starts with all five unlocked; `create` only unlocks what the URL
  // already pointed at (a reload mid-flow) plus whatever "Siguiente" passes
  // from here on.
  const [visitedSteps, setVisitedSteps] = useState<ReadonlySet<EditorStepId>>(() => {
    if (mode === "edit") return new Set(EDITOR_STEPS.map((step) => step.id));
    const upToCurrent = EDITOR_STEPS.slice(0, stepIndex(currentStepId) + 1).map((step) => step.id);
    return new Set(upToCurrent);
  });

  // The geometry chart, in the two modes `CategoryImageField` already knows
  // how to be. On edit the bike exists, so a pick uploads straight away; on
  // create there's no id to POST against, so the `File` is staged here and
  // `handleSubmit` uploads it right after the bike is created — the admin
  // picks it once, up front, instead of saving twice.
  const [geometryImage, setGeometryImage] = useState<CategoryImage | undefined>(() => initialBike?.geometryImage);
  const [pendingGeometryFile, setPendingGeometryFile] = useState<File | null>(null);
  const [pendingGeometryUrl, setPendingGeometryUrl] = useState<string | null>(null);

  // The gallery, staged the same way on create — `GallerySection`'s own
  // `deferred` mode creates each object URL as files are dropped/picked;
  // `persistPendingGallery` uploads the lot once the product has an id.
  const [pendingGallery, setPendingGallery] = useState<StagedGalleryFile[]>([]);
  // Read by the unmount-only cleanup effect below — a ref instead of a
  // dependency because that effect must NOT re-run every time this array
  // changes (see its own comment). Synced in its own effect, not during
  // render: writing a ref mid-render is a React footgun the lint rule
  // (rightly) rejects.
  const pendingGalleryRef = useRef<StagedGalleryFile[]>(pendingGallery);
  useEffect(() => {
    pendingGalleryRef.current = pendingGallery;
  }, [pendingGallery]);

  const [errors, setErrors] = useState<FormErrors>({});
  // Location of the one `specGroups` error `errors.specGroups` names but
  // can't point to on its own — `SpecSheetEditor` only opens one apartado at
  // a time, so this is what lets it open the right one and mark the right
  // input, instead of leaving the admin to search all twenty by hand.
  const [specSheetError, setSpecSheetError] = useState<SpecSheetError | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const productApi = kind === "bike" ? adminBikesApi : adminAccessoriesApi;
  const entityLabel = kind === "bike" ? "Bicicleta" : "Accesorio";

  function goToStep(stepId: EditorStepId): void {
    setCurrentStepId(stepId);
    setVisitedSteps((prev) => (prev.has(stepId) ? prev : new Set(prev).add(stepId)));
    const params = new URLSearchParams(searchParams.toString());
    params.set("paso", String(stepIndex(stepId) + 1));
    // A history entry per step, not a replace: the browser's own back button
    // should step back through the form instead of leaving it entirely.
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const errorEntries = buildErrorEntries(errors, goToStep);

  // Only fires right after a failed `validate()`/"Siguiente" check (the only
  // places `errors` is ever set) — lands the admin on the summary instead of
  // making them hunt for the one red border.
  useEffect(() => {
    if (errorEntries.length > 0) errorSummaryRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only `errors` should re-trigger the focus jump
  }, [errors]);

  // Object URLs are held by the document until revoked, so a staged file the
  // admin never saved would leak its blob for the life of the tab.
  useEffect(() => {
    return () => {
      if (pendingGeometryUrl) URL.revokeObjectURL(pendingGeometryUrl);
    };
  }, [pendingGeometryUrl]);

  // Same leak, extended to the gallery — but deliberately unmount-only
  // (empty deps), unlike the single-file effect above: the gallery is an
  // array whose identity changes on every add/remove/reorder, so an effect
  // keyed to it would revoke every URL — including ones for images still on
  // screen — on each of those changes, not just when the form goes away.
  // `pendingGalleryRef` keeps the cleanup reading the latest list anyway.
  useEffect(() => {
    return () => {
      for (const item of pendingGalleryRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  function stageGeometryFile(file: File): void {
    if (pendingGeometryUrl) URL.revokeObjectURL(pendingGeometryUrl);
    setPendingGeometryFile(file);
    setPendingGeometryUrl(URL.createObjectURL(file));
  }

  function clearStagedGeometryFile(): void {
    if (pendingGeometryUrl) URL.revokeObjectURL(pendingGeometryUrl);
    setPendingGeometryFile(null);
    setPendingGeometryUrl(null);
  }

  /** Every field `validate()` covers, independent of whether the whole form ends up valid — `validate()` and "Siguiente"'s per-step gate both read from this. */
  function computeErrors(): {
    errors: FormErrors;
    priceCents: number | null;
    compareAtPriceCents: number | null;
    /** The specific row `errors.specGroups` names, if any — `undefined` once the sheet is clean. */
    specSheetError: SpecSheetError | undefined;
    /** `specGroups` with every no-op empty row already dropped — what actually goes to the API on a clean validate. */
    prunedSpecGroups: SpecGroup[];
  } {
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

      // Vacío es válido — el campo es opcional. Solo se valida cuando el
      // admin escribió algo.
      const modelYearRaw = bike.modelYear.trim();
      if (modelYearRaw) {
        const modelYearValue = Number(modelYearRaw);
        if (!Number.isInteger(modelYearValue) || modelYearValue < MIN_MODEL_YEAR || modelYearValue > MAX_MODEL_YEAR) {
          nextErrors.modelYear = `El año debe ser un número entero entre ${MIN_MODEL_YEAR} y ${MAX_MODEL_YEAR}.`;
        }
      }
    }

    if (findDuplicateSkuIndices(variants).size > 0) {
      nextErrors.variants = "Hay SKU repetidos entre variantes — corrígelos antes de guardar.";
    }

    // A row `SpecSheetEditor`'s "Agregar especificación" just added and the
    // admin never filled in carries no data at all — pruned in silence,
    // never surfaced as an error. Only what's left after that prune (a group
    // with no title, a row with a value but no label) is a real mistake.
    const prunedSpecGroups = pruneEmptyFields(specGroups);
    const specSheetError = findSpecSheetError(prunedSpecGroups);
    if (specSheetError) nextErrors.specGroups = specSheetError.message;

    return { errors: nextErrors, priceCents, compareAtPriceCents, specSheetError, prunedSpecGroups };
  }

  type ValidationResult =
    | { ok: true; priceCents: number; compareAtPriceCents: number | null; specGroups: SpecGroup[] }
    | { ok: false; errors: FormErrors };

  function validate(): ValidationResult {
    const { errors: nextErrors, priceCents, compareAtPriceCents, specSheetError, prunedSpecGroups } = computeErrors();
    setErrors(nextErrors);
    setSpecSheetError(specSheetError);
    if (Object.keys(nextErrors).length > 0 || priceCents === null) return { ok: false, errors: nextErrors };
    return { ok: true, priceCents, compareAtPriceCents, specGroups: prunedSpecGroups };
  }

  /**
   * `create` only: validates and, if the *current* step owns no errors,
   * advances — errors belonging to other steps don't block leaving this one
   * (they'll gate their own step when its turn comes). Steps that own no
   * validated field (images, review) skip validation entirely and just move
   * on.  `edit` never gates; every step is already unlocked.
   */
  function handleNext(): void {
    const nextStepId = stepIdAt(stepIndex(currentStepId) + 1);
    if (mode === "edit") {
      goToStep(nextStepId);
      return;
    }
    const currentStepDef = EDITOR_STEPS[stepIndex(currentStepId)];
    if (currentStepDef && currentStepDef.errorKeys.length > 0) {
      const { errors: nextErrors, specSheetError } = computeErrors();
      setErrors(nextErrors);
      setSpecSheetError(specSheetError);
      if (stepHasErrors(nextErrors, currentStepId)) return;
    }
    goToStep(nextStepId);
  }

  function handleBack(): void {
    goToStep(stepIdAt(stepIndex(currentStepId) - 1));
  }

  /**
   * The second half of a `edit`-mode save. Its own try/catch so a failure
   * here reports precisely — "the product saved, the sheet didn't" — instead
   * of falling into the generic "no se pudo guardar" from the outer catch,
   * which would wrongly imply nothing was persisted. Takes `groups` rather
   * than reading `specGroups` off the closure: the caller already ran it
   * through `validate()`'s prune, and sending the raw state back here would
   * undo that.
   */
  async function persistSpecSheet(id: string, groups: SpecGroup[]): Promise<boolean> {
    try {
      const saved = await productApi.replaceSpecGroups(id, groups);
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
    if (!validated.ok) {
      const failingStep = firstStepWithErrors(validated.errors);
      if (failingStep) goToStep(failingStep);
      return;
    }
    const { priceCents, compareAtPriceCents, specGroups: sanitizedSpecGroups } = validated;

    const resolvedVariants = variants.map((row) => {
      const overridePrice = row.priceInput.trim() ? parsePriceToCents(row.priceInput) : null;
      // `in_stock`-only, and only for a genuinely new row — mirrors what
      // `VariantsEditor` even renders the field for. A row hydrated from an
      // already-persisted product never reaches this branch, so its stock
      // stays untouched by a PATCH; only a brand-new variant added this
      // session (in either mode) gets its inventory seeded on save.
      const initialStock =
        (mode === "create" || row.isNewRow) && row.fulfillmentMode === "in_stock" && row.initialStock?.trim()
          ? Number.parseInt(row.initialStock, 10)
          : null;
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
        ...(initialStock !== null && Number.isInteger(initialStock) && initialStock >= 0 ? { initialStock } : {}),
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
      isNewArrival,
      isCustomerFavorite,
      // The sheet only rides along on create — on edit it's its own PUT,
      // fired below once the product itself has saved. `sanitizedSpecGroups`,
      // not the raw `specGroups` state — already pruned by `validate()`.
      ...(mode === "create" ? { specGroups: sanitizedSpecGroups } : {}),
    };

    /**
     * The staged chart, uploaded once the bike has an id. Failing here must
     * not read as "nothing saved": the bike itself is already committed, so
     * this reports its own partial failure the same way `persistSpecSheet`
     * does and lets the save go through.
     */
    async function persistPendingGeometry(savedId: string): Promise<void> {
      if (!pendingGeometryFile) return;
      try {
        await adminBikesApi.uploadGeometryImage(savedId, pendingGeometryFile);
        clearStagedGeometryFile();
      } catch (error) {
        toast({
          variant: "error",
          title: "Se guardó la bicicleta, pero no la imagen de geometría",
          description: error instanceof ApiError ? error.message : "Vuelve a subirla desde la edición.",
        });
      }
    }

    /**
     * The staged gallery, uploaded once the product has an id — same
     * partial-failure discipline as `persistPendingGeometry`: the product is
     * already committed by the time this runs, so a failure here has to say
     * so instead of falling into the generic "no se pudo guardar" below,
     * which would wrongly imply nothing was saved at all. "el producto", not
     * `entityLabel`, on purpose — this runs for both kinds, and `entityLabel`
     * has no built-in gender agreement to interpolate safely into a sentence.
     */
    async function persistPendingGallery(savedId: string): Promise<void> {
      if (pendingGallery.length === 0) return;
      try {
        const uploaded = await productApi.uploadGallery(
          savedId,
          pendingGallery.map((item) => item.file),
        );
        for (const item of pendingGallery) URL.revokeObjectURL(item.previewUrl);
        setPendingGallery([]);
        setGallery(uploaded);
      } catch (error) {
        toast({
          variant: "error",
          title: "Se guardó el producto, pero no las imágenes",
          description: error instanceof ApiError ? error.message : "Vuelve a subirlas desde la edición.",
        });
      }
    }

    setSubmitting(true);
    try {
      if (kind === "bike") {
        const modelYearRaw = bike.modelYear.trim();
        const payload: BikeInput = {
          ...sharedPayload,
          shortDescription: bike.shortDescription.trim(),
          ...(modelYearRaw ? { modelYear: Number(modelYearRaw) } : {}),
          // Six bounded rows, so unlike the sheet this rides in the body on
          // create *and* on edit — no second write to fail on its own.
          summary,
          relatedAccessories: relatedAccessories.map((accessory) => accessory.id),
        };
        const saved =
          mode === "create" ? await adminBikesApi.create(payload) : await adminBikesApi.update(productId!, payload);
        if (mode === "edit" && !(await persistSpecSheet(productId!, sanitizedSpecGroups))) return;
        await persistPendingGeometry(saved.id);
        await persistPendingGallery(saved.id);
        afterSave(saved.id);
      } else {
        const payload: AccessoryInput = sharedPayload;
        const saved =
          mode === "create"
            ? await adminAccessoriesApi.create(payload)
            : await adminAccessoriesApi.update(productId!, payload);
        if (mode === "edit" && !(await persistSpecSheet(productId!, sanitizedSpecGroups))) return;
        await persistPendingGallery(saved.id);
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
      toast({ variant: "success", title: `${entityLabel} creada` });
      // `listPath` is already this catalog's list route
      // (`/admin/catalogo/bicicletas` or `/admin/catalogo/accesorios`) since
      // M10.1 gave each catalog its own route — the edit route is a direct
      // child of it.
      router.replace(`${listPath}/${savedId}`);
    } else {
      toast({ variant: "success", title: "Cambios guardados" });
      router.push(listPath);
    }
  }

  function renderStepContent(): ReactNode {
    switch (currentStepId) {
      case "basics":
        return (
          <>
            <EditorSection
              id="section-basics"
              title="Datos generales"
              description="Lo que describe el producto en la ficha pública."
            >
              <ProductBasicsSection value={basics} onChange={setBasics} errors={errors} />
              {kind === "bike" ? <BikeBasicsFields value={bike} onChange={setBike} errors={errors} /> : null}
            </EditorSection>

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

            {/* Curation, so it sits next to Badges — but a separate section
                because it isn't one: a badge is a label the shopper reads on
                the card, this only decides which products the home's
                "Novedades" rail picks up. */}
            <EditorSection
              id="section-novedad"
              title="Novedad"
              description="Aparece en la sección Novedades del inicio, que muestra los 10 productos marcados más recientes."
            >
              <Toggle label="Marcar como novedad" checked={isNewArrival} onChange={setIsNewArrival} />
            </EditorSection>

            {/* Its own section, next to "Novedad" and for the same reason: a
                second, independent home rail the admin curates by hand. A
                product can be novedad, favorita, both, or neither. */}
            <EditorSection
              id="section-favorita"
              title="Favorita"
              description="Aparece en la sección Favoritas de los ciclistas del inicio, que muestra los 10 productos marcados más recientes."
            >
              <Toggle
                label="Marcar como favorita"
                checked={isCustomerFavorite}
                onChange={setIsCustomerFavorite}
              />
            </EditorSection>
          </>
        );

      case "variants": {
        // No category chosen yet (early in `create`): defaults to `true` so
        // the picker doesn't flash hidden-then-shown once "Organización" is filled in.
        const selectedCategory = findCategoryById(categoryTree, basics.category);
        const categoryUsesSizes = selectedCategory?.usesSizes ?? true;

        return (
          <EditorSection
            id="section-variants"
            title="Tallas y variantes"
            description={
              categoryUsesSizes
                ? "Elige las tallas que aplican y captura el SKU, color y disponibilidad de cada una."
                : "Esta categoría no maneja tallas — captura el SKU, color y disponibilidad de cada variante."
            }
            count={{ current: variants.length, max: MAX_VARIANTS }}
          >
            {errors.variants ? <p className="font-body text-caption text-estado-error">{errors.variants}</p> : null}
            {categoryUsesSizes ? (
              <SizePicker sizeTemplates={sizeTemplates} variants={variants} onChange={setVariants} />
            ) : null}
            <VariantsEditor
              variants={variants}
              onChange={setVariants}
              sizeless={!categoryUsesSizes}
              mode={mode}
              productName={basics.name}
              brandName={brandName}
              colorTemplates={colorTemplates}
            />
          </EditorSection>
        );
      }

      case "specs":
        return (
          <>
            {kind === "bike" ? (
              <EditorSection
                id="section-summary"
                title="Resumen"
                description="Lo esencial, junto a la descripción en la ficha pública. Se captura aparte de la ficha técnica, así que un dato que aparezca en las dos se corrige en las dos."
                count={{ current: summary.length, max: MAX_SUMMARY_ROWS }}
                help={<SectionHelp zone="resumen" />}
              >
                <SummaryEditor rows={summary} onChange={setSummary} />
              </EditorSection>
            ) : null}

            <EditorSection
              id="section-specs"
              title="Ficha técnica"
              description="Cada apartado agrupa sus especificaciones. La etiqueta se repite entre productos, p. ej. «Peso»; el valor es el de este producto, p. ej. «8.2 kg»."
              count={{ current: specGroups.length, max: MAX_SPEC_GROUPS }}
              help={<SectionHelp zone="fichaTecnica" />}
            >
              {errors.specGroups ? <p className="font-body text-caption text-estado-error">{errors.specGroups}</p> : null}
              <SpecSheetEditor groups={specGroups} onChange={setSpecGroups} templates={specTemplates} error={specSheetError} />
            </EditorSection>
          </>
        );

      case "images":
        return (
          <>
            {kind === "bike" ? (
              <EditorSection
                id="section-geometry"
                title="Geometría"
                description="El diagrama de geometría de esta bicicleta. Solo imagen: las medidas van dentro del propio diagrama."
                help={<SectionHelp zone="geometria" />}
              >
                {mode === "edit" && productId ? (
                  <CategoryImageField
                    mode="immediate"
                    image={geometryImage}
                    onUpload={async (file) => {
                      setGeometryImage(await adminBikesApi.uploadGeometryImage(productId, file));
                    }}
                    onRemove={async () => {
                      await adminBikesApi.removeGeometryImage(productId);
                      setGeometryImage(undefined);
                    }}
                  />
                ) : (
                  <CategoryImageField
                    mode="deferred"
                    previewUrl={pendingGeometryUrl}
                    onSelect={stageGeometryFile}
                    onClear={clearStagedGeometryFile}
                  />
                )}
              </EditorSection>
            ) : null}

            <EditorSection
              id="section-gallery"
              title="Galería"
              description="La primera imagen es la portada del producto en el storefront."
              count={{
                current: mode === "edit" && productId ? gallery.length : pendingGallery.length,
                max: MAX_GALLERY_IMAGES,
              }}
              help={<SectionHelp zone="galeria" />}
            >
              {mode === "edit" && productId ? (
                <GallerySection
                  mode="immediate"
                  gallery={gallery}
                  onChange={setGallery}
                  onUpload={(files) => productApi.uploadGallery(productId, files)}
                  onRemove={(publicId) => productApi.removeGalleryImage(productId, publicId)}
                  onReorder={(publicIds) => productApi.reorderGallery(productId, publicIds)}
                  availableColors={availableColors}
                  onColorChange={(publicId, color) => productApi.updateGalleryImageColor(productId, publicId, color)}
                />
              ) : (
                <GallerySection mode="deferred" staged={pendingGallery} onChange={setPendingGallery} />
              )}
            </EditorSection>
          </>
        );

      case "review":
        return (
          <>
            {kind === "bike" ? (
              <EditorSection
                id="section-related"
                title="Accesorios sugeridos"
                description="Cross-sell curado a mano para la ficha de esta bicicleta."
                count={{ current: relatedAccessories.length, max: MAX_RELATED_ACCESSORIES }}
                help={<SectionHelp zone="accesorios" />}
              >
                <RelatedAccessoriesPicker
                  selected={relatedAccessories}
                  onChange={setRelatedAccessories}
                  categoryTree={accessoryCategoryTree ?? []}
                />
              </EditorSection>
            ) : null}

            <EditorSection
              id="section-review"
              title="Resumen antes de guardar"
              description="Repasa lo capturado en los pasos anteriores."
            >
              <dl className="flex flex-col gap-xs font-body text-body text-negro">
                <div className="flex justify-between">
                  <dt className="text-grafito">Nombre</dt>
                  <dd>{basics.name.trim() || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-grafito">Precio</dt>
                  <dd>{basics.priceInput.trim() ? `$${basics.priceInput}` : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-grafito">Variantes</dt>
                  <dd>{variants.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-grafito">Ficha técnica</dt>
                  <dd>{specGroups.length === 1 ? "1 apartado" : `${specGroups.length} apartados`}</dd>
                </div>
                {kind === "bike" ? (
                  <div className="flex justify-between">
                    <dt className="text-grafito">Resumen</dt>
                    <dd>{summary.length === 1 ? "1 fila" : `${summary.length} filas`}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-grafito">Galería</dt>
                  <dd>{gallery.length === 1 ? "1 imagen" : `${gallery.length} imágenes`}</dd>
                </div>
              </dl>
            </EditorSection>
          </>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-lg p-md sm:p-lg">
        {errorEntries.length > 0 ? <ErrorSummary ref={errorSummaryRef} entries={errorEntries} /> : null}

        <EditorStepper
          currentStepId={currentStepId}
          errors={errors}
          visitedSteps={visitedSteps}
          mode={mode}
          onSelect={goToStep}
        />

        <div className="flex flex-col gap-lg">{renderStepContent()}</div>
      </div>

      <EditorFooter
        mode={mode}
        entityLabel={entityLabel}
        isFirstStep={stepIndex(currentStepId) === 0}
        isLastStep={stepIndex(currentStepId) === EDITOR_STEPS.length - 1}
        submitting={submitting}
        errorCount={errorEntries.length}
        onCancel={() => router.push(listPath)}
        onBack={handleBack}
        onNext={handleNext}
        onSubmit={() => void handleSubmit()}
      />
    </div>
  );
}
