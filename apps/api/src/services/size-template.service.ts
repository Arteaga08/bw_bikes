import type {
  AuditAction,
  ProductVariant,
  PublicSizeGuideEntry,
  SizeTemplate as PublicSizeTemplate,
} from "@bw-bikes/shared";
import { type Model, Types } from "mongoose";
import { logger } from "../config/logger.js";
import {
  type ISizeCategoryOverride,
  type ISizeHeightRange,
  type ISizeTemplate,
  MAX_SIZE_TEMPLATES,
} from "../models/index.js";
import { AppError, buildMeta, escapeRegex, parseListQuery } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";

const SORTABLE_FIELDS = ["order", "value", "createdAt"] as const;

interface SizeTemplateInput {
  value?: string;
  order?: number;
  isActive?: boolean;
  heightRange?: ISizeHeightRange | null;
  categoryOverrides?: Array<{ categoryId: string; minHeightCm: number; maxHeightCm: number }>;
}

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

/**
 * Admin-only by construction (see `SizeTemplate`'s own doc comment) — no
 * public/admin split, unlike `toPublicBrand`/`toAdminBrand`.
 *
 * `template.categoryOverrides ?? []`: this schema field postdates every size
 * template already in the database, and callers read through `.lean()`
 * (`list()` below, and `getBikeSizeGuide`'s own query) — `.lean()` skips
 * Mongoose's document hydration, so it never backfills a schema `default`
 * onto a raw document that predates the field. Without the fallback, every
 * size saved before this migration 500s the moment it's listed.
 */
export function toSizeTemplateDto(template: ISizeTemplate): PublicSizeTemplate {
  return {
    id: String(template._id),
    value: template.value,
    source: template.source,
    order: template.order,
    isActive: template.isActive,
    heightRange: template.heightRange
      ? { minHeightCm: template.heightRange.minHeightCm, maxHeightCm: template.heightRange.maxHeightCm }
      : undefined,
    categoryOverrides: (template.categoryOverrides ?? []).map((override) => ({
      categoryId: String(override.categoryId),
      minHeightCm: override.minHeightCm,
      maxHeightCm: override.maxHeightCm,
    })),
  };
}

/** Joi has already validated shape/bounds by the time this runs — just turns the wire's string `categoryId` into the `ObjectId` the schema stores. `undefined` input (field omitted from a PATCH) maps to `[]` so `create`'s spread has something to assign, not to "leave the array untouched" (that case is handled by `update`'s own `!== undefined` guard, not here). */
function toModelCategoryOverrides(
  overrides: SizeTemplateInput["categoryOverrides"],
): ISizeCategoryOverride[] {
  return (overrides ?? []).map((override) => ({
    categoryId: new Types.ObjectId(override.categoryId),
    minHeightCm: override.minHeightCm,
    maxHeightCm: override.maxHeightCm,
  }));
}

/**
 * The bits `resolveHeightRange` actually reads off a template — deliberately
 * not `Pick<ISizeTemplate, ...>`: that would force `categoryId` to be a real
 * Mongoose `Types.ObjectId`, coupling this pure resolver (and every test of
 * it) to a live document shape it has no other reason to need. Every caller
 * — the Mongoose document `buildSizeGuide` iterates, and a plain fixture in
 * a unit test — satisfies this structurally.
 */
export interface ResolvableSizeTemplate {
  heightRange?: ISizeHeightRange;
  /** Optional for the same reason `toSizeTemplateDto`'s fallback exists — a `.lean()`-read document that predates this field simply won't have it. */
  categoryOverrides?: Array<{ categoryId: string | Types.ObjectId; minHeightCm: number; maxHeightCm: number }>;
}

/**
 * Resolves the height range a size fits for one product, given its category
 * (and, when the tree is two levels deep, that category's parent). Precedence,
 * most specific first:
 *
 * 1. A `categoryOverrides` entry matching the product's own category exactly.
 * 2. A `categoryOverrides` entry matching the category's parent — so an
 *    override captured on a root category ("Ruta") still applies to its
 *    children ("Ruta Endurance") without having to be re-entered on each one.
 * 3. The template's base `heightRange`.
 * 4. `undefined` — this size has no height data at all, and the caller
 *    (`buildSizeGuide`) leaves it out of the guide rather than guessing.
 */
export function resolveHeightRange(
  template: ResolvableSizeTemplate,
  categoryId: string | Types.ObjectId,
  parentCategoryId?: string | Types.ObjectId | null,
): ISizeHeightRange | undefined {
  const categoryIdStr = String(categoryId);
  const parentIdStr = parentCategoryId ? String(parentCategoryId) : undefined;
  const overrides = template.categoryOverrides ?? [];

  const exact = overrides.find((override) => String(override.categoryId) === categoryIdStr);
  if (exact) return { minHeightCm: exact.minHeightCm, maxHeightCm: exact.maxHeightCm };

  if (parentIdStr) {
    const parentMatch = overrides.find((override) => String(override.categoryId) === parentIdStr);
    if (parentMatch) return { minHeightCm: parentMatch.minHeightCm, maxHeightCm: parentMatch.maxHeightCm };
  }

  return template.heightRange
    ? { minHeightCm: template.heightRange.minHeightCm, maxHeightCm: template.heightRange.maxHeightCm }
    : undefined;
}

/**
 * The storefront size guide for one bike category — every active size that
 * has a resolvable height range, in display order. Sizes with no data at all
 * (never captured, or captured for a different category with no override
 * here) are silently omitted rather than shown with a made-up range.
 */
export function buildSizeGuide(
  templates: ISizeTemplate[],
  categoryId: string | Types.ObjectId,
  parentCategoryId?: string | Types.ObjectId | null,
): PublicSizeGuideEntry[] {
  return templates
    .filter((template) => template.isActive)
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((template) => {
      const range = resolveHeightRange(template, categoryId, parentCategoryId);
      return range ? [{ value: template.value, minHeightCm: range.minHeightCm, maxHeightCm: range.maxHeightCm }] : [];
    });
}

/**
 * One CRUD engine, instantiated once per size catalog (bikes, accessories) —
 * same shape as `createCategoryService`. The two catalogs stay genuinely
 * independent — separate collections, separate `value` uniqueness scopes —
 * while the rules that govern them are written once. `moduleName` only labels
 * the audit entries, so a reader can tell which catalog a change belongs to.
 */
export function createSizeTemplateService(SizeTemplate: Model<ISizeTemplate>, moduleName: string) {
  async function findByValue(value: string): Promise<ISizeTemplate | null> {
    return SizeTemplate.findOne({ value: { $regex: `^${escapeRegex(value)}$`, $options: "i" } }).exec();
  }

  async function assertValueIsFree(value: string, selfId?: string): Promise<void> {
    const existing = await findByValue(value);
    if (existing && String(existing._id) !== selfId) {
      throw new AppError(`Ya existe una talla con el valor "${value}".`, 409);
    }
  }

  async function findByIdOrFail(id: string): Promise<ISizeTemplate> {
    const template = await SizeTemplate.findById(id).exec();
    if (!template) {
      throw new AppError("Talla no encontrada.", 404);
    }
    return template;
  }

  async function list(query: Record<string, unknown>, options: { publicOnly: boolean }) {
    const { page, limit, skip, sort, search } = parseListQuery(query, {
      allowedSortFields: SORTABLE_FIELDS,
      defaultSort: "order",
    });

    const filter: Record<string, unknown> = {};
    if (options.publicOnly) {
      filter["isActive"] = true;
    } else if (typeof query["isActive"] === "boolean") {
      filter["isActive"] = query["isActive"];
    }

    if (search) {
      filter["value"] = { $regex: escapeRegex(search), $options: "i" };
    }

    // `.lean()`: callers only ever map these through their plain-field DTO
    // functions — no document methods needed downstream.
    const [documents, total] = await Promise.all([
      SizeTemplate.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      SizeTemplate.countDocuments(filter).exec(),
    ]);

    return { documents: documents as unknown as ISizeTemplate[], meta: buildMeta(total, page, limit) };
  }

  async function create(input: SizeTemplateInput, actor: ActorContext): Promise<ISizeTemplate> {
    const value = input.value!;
    await assertValueIsFree(value);

    const templateCount = await SizeTemplate.countDocuments().exec();
    if (templateCount >= MAX_SIZE_TEMPLATES) {
      throw new AppError(`No se pueden crear más de ${MAX_SIZE_TEMPLATES} tallas.`, 400);
    }

    const template = await SizeTemplate.create({
      value,
      source: "manual",
      order: input.order ?? 0,
      isActive: input.isActive ?? true,
      heightRange: input.heightRange ?? undefined,
      categoryOverrides: toModelCategoryOverrides(input.categoryOverrides),
    });

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.size_template_created" satisfies AuditAction,
      module: moduleName,
      targetId: String(template._id),
      after: { value: template.value },
      ip: actor.ip,
    });

    return template;
  }

  async function update(id: string, input: SizeTemplateInput, actor: ActorContext): Promise<ISizeTemplate> {
    const template = await findByIdOrFail(id);
    const before = { value: template.value };

    if (input.value !== undefined && input.value !== template.value) {
      await assertValueIsFree(input.value, id);
      template.value = input.value;
    }
    if (input.order !== undefined) template.order = input.order;
    if (input.isActive !== undefined) template.isActive = input.isActive;
    if (input.heightRange !== undefined) template.heightRange = input.heightRange ?? undefined;
    if (input.categoryOverrides !== undefined) template.categoryOverrides = toModelCategoryOverrides(input.categoryOverrides);

    await template.save();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.size_template_updated" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before,
      after: { value: template.value },
      ip: actor.ip,
    });

    return template;
  }

  async function remove(id: string, actor: ActorContext): Promise<void> {
    const template = await findByIdOrFail(id);
    await template.deleteOne();

    await recordAuditLog({
      actorId: actor.actorId,
      actorType: "user",
      action: "catalog.size_template_deleted" satisfies AuditAction,
      module: moduleName,
      targetId: id,
      before: { value: template.value },
      ip: actor.ip,
    });
  }

  /**
   * Learns from a product's variants after it's saved — never before: this is
   * memory, not validation, so it must never be able to block the write that
   * triggered it. Awaited by its callers, same discipline as
   * `learnSpecTemplates`/`recordAuditLog` — not fire-and-forget, so it's done
   * by the time the response goes out, but its own try/catch below means a
   * failure here can never fail a product save that already succeeded.
   *
   * Each distinct, non-empty `size` among the variants gets its own template:
   * an existing one (case-insensitive match) is left untouched — never
   * re-derived from `manual` to `auto` — and a size never seen before becomes
   * a new `auto` template, unless the collection is already at its cap, in
   * which case learning silently no-ops rather than blocking the product save
   * the way a hard limit on a foreground write would.
   */
  async function learnSizeTemplates(variants: ProductVariant[]): Promise<void> {
    try {
      const sizes = new Set(
        variants.map((variant) => variant.size?.trim()).filter((size): size is string => Boolean(size)),
      );

      for (const value of sizes) {
        const existing = await findByValue(value);
        if (existing) continue;

        const templateCount = await SizeTemplate.countDocuments().exec();
        if (templateCount >= MAX_SIZE_TEMPLATES) continue;

        await SizeTemplate.create({ value, source: "auto", order: templateCount });
      }
    } catch (error) {
      logger.error({ err: error }, "[size-template] Failed to learn size templates from a product save");
    }
  }

  return { list, findByIdOrFail, create, update, remove, learnSizeTemplates };
}

export type SizeTemplateService = ReturnType<typeof createSizeTemplateService>;
